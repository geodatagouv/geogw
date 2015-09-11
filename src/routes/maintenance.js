import { Router } from 'express';

import { processAllRecords, consolidateAllRecords } from '../controllers/maintenance';
import { isMaintenance } from './middlewares/auth';

export default function (app) {
    const router = new Router();

    /* Routes */
    router.post('/process-all-records', processAllRecords);
    router.post('/consolidate-all-records', consolidateAllRecords);

    app.use('/maintenance', isMaintenance, router);
}
