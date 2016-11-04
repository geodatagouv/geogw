const express = require('express');
const kue = require('kue');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { walk } = require('./utils');

const app = express();

app.use(cors());
app.use(bodyParser.json());

// Mount regular routes
const geogwRouter = new express.Router();
walk(path.join(__dirname, 'routes'), 'middlewares', path => require(path)(geogwRouter));
app.use('/api/geogw', geogwRouter);

// Mount publish-to-udata plugin
app.use('/dgv', require('../plugins/publish-to-udata/app')());

// Mount kue
app.use('/kue', kue.app);

module.exports = app;
