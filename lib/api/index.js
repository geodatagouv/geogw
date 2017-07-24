'use strict'

const { Router } = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const walk = require('../util/walk')

const app = new Router()

app.use(cors({ origin: true }))
app.use(bodyParser.json())

walk(__dirname + '/routes', 'middlewares', path => require(path)(app))

module.exports = app
