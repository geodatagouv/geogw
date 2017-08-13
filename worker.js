'use strict'

// Configure
require('./lib/config/mongoose')
require('./lib/config/jobs')

require('./lib/util/jobs').startProcessing()
