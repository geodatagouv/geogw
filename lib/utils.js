var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

// recursively walk modules path and callback for each file
var walk = function(modulesPath, excludeDir, callback) {
    fs.readdirSync(modulesPath).forEach(function(file) {
        var newPath = path.join(modulesPath, file);
        var stat = fs.statSync(newPath);
        if (stat.isFile() && /(.*)\.(js|coffee)$/.test(file)) {
            callback(newPath);
        } else if (stat.isDirectory() && file !== excludeDir) {
            walk(newPath, excludeDir, callback);
        }
    });
};

exports.walk = walk;

exports.hashRecordId = function (recordId) {
    return crypto.createHash('sha1').update(recordId, 'utf8').digest('hex');
};
