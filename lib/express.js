'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { walk } = require('./utils');
const { authenticateClient } = require('./routes/middlewares/auth');

const app = express();

app.use(bodyParser.json());

// Mount regular routes
const geogwRouter = new express.Router();
geogwRouter.use(cors({ origin: true }));
geogwRouter.use(authenticateClient);
walk(path.join(__dirname, 'routes'), 'middlewares', path => require(path)(geogwRouter));
app.use('/api/geogw', geogwRouter);

// Mount webhooks
app.use('/hooks', require('./webhooks'));

// Mount publish-to-udata plugin
app.use('/dgv', require('../plugins/publish-to-udata/app')());

module.exports = app;
