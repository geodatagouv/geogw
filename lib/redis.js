var redis = require('redis');

var port = process.env.REDIS_PORT;
var host = process.env.REDIS_HOST;

exports.createClient = function() {
    return redis.createClient(port, host);
};
