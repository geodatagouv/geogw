'use strict'
/* eslint no-console: off */

require('./lib/config/jobs')

const { getApp } = require('delayed-jobs')

const port = process.env.PORT || 3030
getApp().listen(port)
console.log(`Kue App is listening on port ${port}`)
