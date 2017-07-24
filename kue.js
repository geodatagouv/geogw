'use strict'

/* eslint no-console: off */
const { app } = require('./lib/jobs')
const port = process.env.PORT || 3030

app.listen(port)
console.log(`Kue App is listening on port ${port}`)
