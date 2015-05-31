// TO BE REPLACED OR PARTIALLY REPLACED BY A CALL TO A davidbgk/croquemort INSTANCE
var request = require('superagent');
var fileType = require('file-type');
var contentDisposition = require('content-disposition');
var debug = require('debug')('check-url');


function checkUrl(location, done) {
    debug('began');
    var req = request.get(location).buffer(false).end();
    var checkResult = {};

    debug('started request');
    // Propagate request error
    req.on('error', function (err) {
        debug('errored', err);
        done(err);
    });

    // Handle response
    req.on('response', function (resp) {
        debug('received response');

        function finish() {
            // Ensure current request is abort
            resp.destroy();
            debug('finished', checkResult);
            done(null, checkResult);
        }

        checkResult.statusCode = resp.status;
        checkResult.contentType = resp.headers['content-type'];

        if (resp.headers['content-disposition']) {
            checkResult.contentDisposition = contentDisposition.parse(resp.headers['content-disposition']);
        }

        checkResult.headers = resp.headers;

        if (!resp.headers['content-type'] || resp.headers['content-type'] === 'application/octet-stream') {
            // Try to discover file type
            resp.once('data', function (chunk) {
                checkResult.fileType = fileType(chunk);
                finish();
            });
        } else {
            finish();
        }
    });
}


module.exports = checkUrl;
