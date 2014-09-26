/*
** Module dependencies
*/
var kue = require('kue');
var redis = require('./redis');

exports.jobs = kue.createQueue({ disableSearch: true });
exports.Job = kue.Job;
