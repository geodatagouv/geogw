'use strict'

const express = require('express')
const { authenticateClient } = require('./api/routes/middlewares/auth')

const app = express()

app.use('/api/geogw', authenticateClient, require('./api'))
app.use('/hooks', require('./webhooks'))

// Mount publish-to-udata plugin
// app.use('/dgv', require('../plugins/publish-to-udata/app')())

module.exports = app
