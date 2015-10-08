import { Router } from 'express';

import { processAllRecords, consolidateAllRecords, checkAllRemoteResources } from '../controllers/maintenance';
import { isMaintenance } from './middlewares/auth';

export default function (app) {
    const router = new Router();

    /* Routes */
    router.post('/process-all-records', processAllRecords);
    router.post('/consolidate-all-records', consolidateAllRecords);
    router.post('/check-all-remote-resources', checkAllRemoteResources);

    app.use('/maintenance', isMaintenance, router);
}
