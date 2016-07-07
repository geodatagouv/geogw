const { Router } = require('express');

const { processAllRecords, consolidateAllRecords, checkAllRemoteResources } = require('../controllers/maintenance');
const { isMaintenance } = require('./middlewares/auth');

module.exports = function (app) {
    const router = new Router();

    /* Routes */
    router.post('/process-all-records', processAllRecords);
    router.post('/consolidate-all-records', consolidateAllRecords);
    router.post('/check-all-remote-resources', checkAllRemoteResources);

    app.use('/maintenance', isMaintenance, router);
};
