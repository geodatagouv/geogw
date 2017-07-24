'use strict'

const redisConfig = require('./redis')

// Configuration
const jobsPath = __dirname + '/../jobs'

module.exports = {
  kuePrefix: process.env.KUE_PREFIX || 'q',
  redisConfig,
  prefix: 'geogw',
  jobsPath,
  definitionsPath: jobsPath + '/definitions.yml',
}
