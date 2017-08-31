'use strict'

const { readFileSync } = require('fs')

const { createClient } = require('redis')
const kue = require('kue')
const Redlock = require('redlock')
const Promise = require('bluebird')

const { safeLoad } = require('js-yaml')
const { keyBy, once } = require('lodash')
const debug = require('debug')('jobs')

let definitions
let queue
let prefix
let redlock
let jobsPath

let configured = false
let processing = false

function configure(config) {
  if (configured) throw new Error('Already configured')

  // Configure redlock
  const client = createClient(config.redisConfig.port, config.redisConfig.host)
  redlock = new Redlock([client])

  redlock.on('clientError', function (err) {
    console.error('A redis error has occurred:', err)
  })

  // Load jobs definitions
  definitions = keyBy(safeLoad(readFileSync(config.definitionsPath, 'utf8')), 'name')

  // Create queue
  queue = kue.createQueue({
    disableSearch: true,
    prefix: config.kuePrefix,
    redis: {
      port: config.redisConfig.port,
      host: config.redisConfig.host,
    },
  })

  // Export some config values
  prefix = config.prefix
  jobsPath = config.jobsPath

  configured = true
}

/* Public API */

function startProcessing() {
  mustBeConfigured()
  if (processing) throw new Error('startProcessing already triggered')

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
  mustBeConfigured()
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

function getApp() {
  mustBeConfigured()
  return kue.app
}

/* Helpers */

function getFullJobName(jobName) {
  return prefix + ':' + jobName
}

function lock(jobName, uniqueValue, ttl) {
  return redlock.lock(`${prefix}:${jobName}:lock:${uniqueValue}`, ttl)
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
    await require(jobsPath + '/' + jobName).handler({
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

function mustBeConfigured() {
  if (!configured) {
    throw new Error('Not configured yet')
  }
}

/* Exports */

module.exports = {
  configure,
  startProcessing,
  queue,
  enqueue,
  getApp,
}
