'use strict'

// To remove in the future
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

// More cas
require('ssl-root-cas/latest').inject()

// Configure
require('./config/mongoose')
require('./config/jobs')

require('./lib/jobs').startProcessing()
