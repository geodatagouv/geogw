const Promise = require('bluebird');
const { jobs } = require('../kue');
const defaults = require('lodash/object/defaults');

const taskOptions = {
    'process-record': { removeOnComplete: true, attempts: 5 },
    'dataset:consolidate': { removeOnComplete: true, attempts: 5 },
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

    /* Return a promise */
    return new Promise((resolve, reject) => {
        job.save(err => {
            if (err) return reject(err);
            resolve(job);
        });
    });
};
