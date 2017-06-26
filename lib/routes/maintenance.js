const { Router } = require('express');

const { processAllRecords, consolidateRecords, computeCatalogsMetrics } = require('../controllers/maintenance');
const { isMaintenance } = require('./middlewares/auth');

module.exports = function (app) {
    const router = new Router();

    /* Routes */
    router.post('/process-all-records', processAllRecords);
    router.post('/consolidate-records', consolidateRecords);
    router.post('/compute-catalogs-metrics', computeCatalogsMetrics);

    app.use('/maintenance', isMaintenance, router);
};
