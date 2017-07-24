'use strict'

const kue = require('kue')
const Promise = require('bluebird')
const { readFileSync } = require('fs')
const { safeLoad } = require('js-yaml')
const { keyBy, once } = require('lodash')
const config = require('../config/jobs')

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

let processing = false

function startProcessing() {
  if (processing) return

  Object.keys(definitions).forEach(jobName => {
    queue.process(getFullJobName(jobName), definitions[jobName].concurrency || 1, function (job, done) {
      require(config.jobsPath + '/' + jobName).handler({
        data: job.data,
        log: job.log.bind(job),
        progress: job.progress.bind(job),
      }).then(() => done()).catch(done)
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
  if (options.ttl) job.ttl(options.ttl)
  if (options.backoff) job.backoff(options.backoff)

  /* Return a promise */
  return new Promise((resolve, reject) => {
    job.save(err => {
      if (err) return reject(err)
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
