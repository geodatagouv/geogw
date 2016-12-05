const { Router } = require('express');

const { processAllRecords, consolidateRecords } = require('../controllers/maintenance');
const { isMaintenance } = require('./middlewares/auth');

module.exports = function (app) {
    const router = new Router();

    /* Routes */
    router.post('/process-all-records', processAllRecords);
    router.post('/consolidate-records', consolidateRecords);

    app.use('/maintenance', isMaintenance, router);
};
