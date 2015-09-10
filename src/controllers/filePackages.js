import Plunger from '../helpers/plunger';
import strLeftBack from 'underscore.string/strLeftBack';
import find from 'lodash/collection/find';
import includes from 'lodash/collection/includes';


exports.loadLayer = function (req, res, next) {
    const notFound = message => res.status(404).send({
        code: 404,
        message: message || 'Layer not found in given file package'
    });

    const datasets = req.remoteResource.archive.datasets;

    if (req.params.layerName) {
        let foundLayer = find(datasets, dataset => dataset.includes(req.params.layerName));
        if (foundLayer) {
            req.layer = foundLayer;
            return next();
        }
    }

    // Compatibility
    if (!req.params.layerName && datasets.length > 0) {
        req.layer = datasets[0];
        return next();
    }

    notFound();
};

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
                        if (!includes(files.datasets, req.layer)) {
                            return notFound(); // Should trigger remote resource refresh
                        }
                        const layerPath = req.plunger.decompressedDirectoryPath + '/' + req.layer;
                        const layerName = strLeftBack(req.layer, '.');
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
