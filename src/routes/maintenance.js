import { Router } from 'express';

import { processAllRecords } from '../controllers/maintenance';
import { isMaintenance } from './middlewares/auth';

export default function (app) {
    const router = new Router();

    /* Routes */
    router.get('/process-all-records', processAllRecords);

    app.use('/maintenance', isMaintenance, router);
}
