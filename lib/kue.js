const kue = require('kue');

exports.jobs = kue.createQueue({
    disableSearch: true,
    prefix: process.env.KUE_PREFIX || 'q',
    redis: {
        port: process.env.REDIS_PORT,
        host: process.env.REDIS_HOST
    }
});

exports.Job = kue.Job;
