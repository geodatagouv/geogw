'use strict'

const path = require('path')
const mongoose = require('mongoose')
const Promise = require('bluebird')

const utils = require('../lib/utils')

mongoose.Promise = Promise

mongoose.connect(process.env.MONGODB_URL)

utils.walk(path.join(__dirname, '..', 'models'), null, function(path) {
  require(path)
})
