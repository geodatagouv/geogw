/*
** Module dependencies
*/
var kue = require('kue');
var redis = require('./redis');

exports.jobs = kue.createQueue({
    disableSearch: true,
    prefix: process.env.KUE_PREFIX || 'q',
    redis: {
        createClientFactory: function() {
            return redis.createClient();
        }
    }
});

exports.Job = kue.Job;
