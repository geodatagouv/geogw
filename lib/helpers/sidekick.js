'use strict';

const Promise = require('bluebird');
const { jobs } = require('../kue');
const { defaults } = require('lodash');

const taskOptions = {
    'process-record': { removeOnComplete: true, attempts: 5 },
    'dataset:consolidate': { removeOnComplete: true, attempts: 2, ttl: 30000, backoff: { delay: 10 * 1000, type: 'fixed' } },
    'dgv:publish': { removeOnComplete: true },
    'udata:synchronizeOne': { removeOnComplete: true }
};

module.exports = function (taskName, taskData, options = {}) {
    if (taskName in taskOptions) {
        defaults(options, taskOptions[taskName]);
    }

    const job = jobs.create(taskName, taskData);


    /* Pass options to kue */
    if (options.removeOnComplete) job.removeOnComplete(true);
    if (options.attempts) job.attempts(options.attempts);
    if (options.priority) job.priority(options.priority);
    if (options.ttl) job.ttl(options.ttl);
    if (options.backoff) job.backoff(options.backoff);

    /* Return a promise */
    return new Promise((resolve, reject) => {
        job.save(err => {
            if (err) return reject(err);
            resolve(job);
        });
    });
};
