'use strict'

const Redlock = require('redlock')

const client = require('redis').createClient(
  process.env.REDIS_PORT,
  process.env.REDIS_HOST
)

const redlock = new Redlock(
  [client],
  {
    // the expected clock drift; for more details
    // see http://redis.io/topics/distlock
    driftFactor: 0.01, // time in ms

    // the max number of times Redlock will attempt
    // to lock a resource before erroring
    retryCount: 3,

    // the time in ms between attempts
    retryDelay: 200, // time in ms
  }
)

redlock.on('clientError', function (err) {
  console.error('A redis error has occurred:', err)
})

module.exports = redlock
