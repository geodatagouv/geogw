'use strict'

// To remove in the future
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

// More cas
require('ssl-root-cas/latest').inject()

// Configure
require('./lib/config/mongoose')
require('./lib/config/jobs')

require('./lib/util/jobs').startProcessing()
