'use strict'

const { readFileSync } = require('fs')

const { createClient } = require('redis')
const kue = require('kue')
const Redlock = require('redlock')
const Promise = require('bluebird')

const { safeLoad } = require('js-yaml')
const { keyBy, once } = require('lodash')
const debug = require('debug')('jobs')
const config = require('../config/jobs')

// Configure Redlock
const client = createClient(config.redisConfig.port, config.redisConfig.host)
const redlock = new Redlock([client])

redlock.on('clientError', function (err) {
  console.error('A redis error has occurred:', err)
})

function lock(jobName, resourceName, ttl) {
  return redlock.lock(`${config.prefix}:${jobName}:lock:${resourceName}`, ttl)
}

// Load jobs definitions
const definitions = keyBy(safeLoad(readFileSync(config.definitionsPath, 'utf8')), 'name')

// Create queue
const queue = kue.createQueue({
  disableSearch: true,
  prefix: config.kuePrefix,
  redis: {
    port: config.redisConfig.port,
    host: config.redisConfig.host,
  },
})

function getFullJobName(jobName) {
  return config.prefix + ':' + jobName
}

async function runJobWrapper(jobName, job) {
  const definition = definitions[jobName]
  const { uniqueKey, timeout } = definition

  let jobLock

  if (uniqueKey && timeout && job.data[uniqueKey]) {
    jobLock = await lock(jobName, job.data[uniqueKey], timeout)
  }

  debug('start processing job %s', jobName)

  try {
    await require(config.jobsPath + '/' + jobName).handler({
      data: job.data,
      log: job.log.bind(job),
      progress: job.progress.bind(job),
    })
  } catch (err) {
    if (jobLock) {
      jobLock.unlock().catch(console.error)
    }
    throw err
  }

  if (jobLock) {
    jobLock.unlock().catch(console.error)
  }
}

let processing = false

function startProcessing() {
  if (processing) return

  Object.keys(definitions).forEach(jobName => {
    queue.process(getFullJobName(jobName), definitions[jobName].concurrency || 1, function (job, done) {
      runJobWrapper(jobName, job).then(() => done()).catch(done)
    })
  })

  const gracefulShutdown = once(function () {
    queue.shutdown(5000, function (err) {
      console.log('Job queue is shut down. ', err || '')
      process.exit()
    })
  })

  process.on('message', function (msg) {
    if (msg === 'shutdown') {
      gracefulShutdown()
    }
  })

  process.on('SIGTERM', gracefulShutdown)

  process.on('uncaughtException', function (err) {
    console.log('Uncaught exception!!')
    console.log(err)
    gracefulShutdown()
  })

  processing = true
}

function enqueue(jobName, jobData = {}, overrideOptions = {}) {
  if (!definitions[jobName]) throw new Error('Unknown job ' + jobName)

  const jobDefinition = definitions[jobName]

  const data = jobDefinition.default ?
    Object.assign({}, jobDefinition.params, jobData) :
    jobData

  const options = jobDefinition.options ?
    Object.assign({}, jobDefinition.options, overrideOptions) :
    overrideOptions

  const job = queue.create(getFullJobName(jobName), data)

  /* Set options to kue */
  if (options.removeOnComplete !== false) job.removeOnComplete(true)
  if (options.attempts) job.attempts(options.attempts)
  if (options.priority) job.priority(options.priority)
  if (jobDefinition.timeout) job.ttl(jobDefinition.timeout)
  if (options.backoff) job.backoff(options.backoff)

  /* Return a promise */
  return new Promise((resolve, reject) => {
    job.save(err => {
      if (err) return reject(err)
      debug('enqueued job %s', jobName)
      resolve(job)
    })
  })
}

module.exports = {
  startProcessing,
  queue,
  enqueue,
  app: kue.app,
}
