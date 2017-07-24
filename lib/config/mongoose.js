'use strict'

const mongoose = require('mongoose')

// Configuration
const config = {
  mongo: {
    url: process.env.MONGODB_URL || 'mongodb://localhost/geogw',
  },
}

// Configure mongoose
mongoose.Promise = require('bluebird')
mongoose.connect(config.mongo.url, { useMongoClient: true })

// Load models
require('require-all')(__dirname + '/../models', { recursive: false })
