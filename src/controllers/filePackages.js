var request = require('superagent');
var tmp = require('tmp');
var fs = require('fs');


exports.prepateFilePackageDownload = function (req, res, next) {
    if (!req.remoteResource.available) {
        return res.status(404).send({
            code: 404,
            message: 'Resource not available' // To improve
        });
    }

    tmp.file({ postfix: '.zip' }, function (err, path, fd, clean) {
        if (err) return next(err);

        var success = function () {
            req.ogr2ogr = {};
            req.ogr2ogr.src = path;
            next();
        };

        var r = request.get(req.remoteResource.location)
            .buffer(false)
            .end();

        r.on('error', next);
        r.on('response', function (resp) {
            if (resp.status !== 200 || resp.headers['content-type'] !== 'application/octet-stream') {
                resp.destroy();
                res.status(404).send({
                    code: 404,
                    message: 'Remote resource is currently unavailable'
                });
            } else {
                if (req.method === 'HEAD') {
                    clean();
                    resp.destroy();
                    success();
                } else {
                    resp.pipe(fs.createWriteStream(path))
                        .on('error', next)
                        .on('finish', success);
                }
            }
        });
    });


};
