/*
** Module dependencies
*/
var kue = require('kue');
var redis = require('./redis');

kue.redis.createClient = redis.createClient;

exports.jobs = kue.createQueue({ disableSearch: true });
exports.Job = kue.Job;
