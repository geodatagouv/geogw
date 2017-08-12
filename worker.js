'use strict'

// To remove in the future
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

if (process.env.NODE_ENV !== 'production') {
  require('longjohn')
}

// More cas
require('ssl-root-cas/latest').inject()

// Configure
require('./lib/config/mongoose')
require('./lib/config/jobs')

require('./lib/util/jobs').startProcessing()
