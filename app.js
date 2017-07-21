'use strict'

require('./config/mongoose')
require('./lib/kue')

module.exports = require('./lib/express')
