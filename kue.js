'use strict'

/* eslint no-console: off */
const { configure, getApp } = require('./lib/util/jobs')

const port = process.env.PORT || 3030
const jobsConfig = require('./lib/config/jobs')

configure(jobsConfig)
getApp().listen(port)

console.log(`Kue App is listening on port ${port}`)
