import Plunger from '../helpers/plunger';
import strLeftBack from 'underscore.string/strLeftBack';

exports.prepateFilePackageDownload = function (req, res, next) {

    const success = (layerPath, layerName) => {
        req.ogr2ogr = {};
        req.ogr2ogr.src = layerPath;
        req.ogr2ogr.fileName = layerName;
        next();
    };

    const notFound = err => res.status(404).send({
        code: 404,
        message: 'Resource currently unavailable',
        error: err
    });

    const notImplemented = err => res.status(501).send({
        code: 501,
        message: 'Resource cannot be processed',
        error: err
    });

    const serverError = err => res.status(500).send({
        code: 500,
        message: 'Internal server error',
        error: err
    });

    if (!req.remoteResource.available) {
        return notFound();
    }

    req.plunger = new Plunger(req.remoteResource.location, { abort: 'never' });

    req.plunger.inspect()
        .then(() => {
            if (req.plunger.isArchive() && req.method === 'GET') {
                return req.plunger.saveArchive()
                    .then(() => req.plunger.decompressArchive())
                    .then(() => req.plunger.listFiles())
                    .then(files => {
                        if (files.datasets.length !== 1) {
                            return notImplemented(new Error('Expected 1 layer in archive but found: ' + files.datasets.length));
                        }
                        const layerPath = req.plunger.decompressedDirectoryPath + '/' + files.datasets[0];
                        const layerName = strLeftBack(files.datasets[0], '.');
                        return success(layerPath, layerName);
                    });
            }

            req.plunger.closeConnection(true);

            if (!req.plunger.isArchive()) {
                return notFound();
            }

            if (req.method === 'HEAD') {
                return success();
            }
        })
        .error(serverError);
};
