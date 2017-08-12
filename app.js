'use strict'

if (process.env.NODE_ENV !== 'production') {
  require('longjohn')
}

require('./lib/config/mongoose')
require('./lib/config/jobs')

module.exports = require('./lib/express')
