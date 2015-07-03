var request = require('superagent');
var async = require('async');
var debug = require('debug')('dgv-api');

var rootUrl = process.env.DATAGOUV_URL + '/api/1';

function handleAuthorizedRequest(req, accessToken, done) {
    req.set('Authorization', 'Bearer ' + accessToken).end(function (err, resp) {
        debug('%s %s %d', resp.req.method, resp.req.path, resp.status);
        if (err) return done(err);
        if (resp.status === 401) return done(new Error('Unauthorized'));
        if (resp.error) {
            debug('Returned status %d with body:', resp.status);
            debug(resp.body);
            return done(new Error('dgv: Unexpected status'));
        }
        if (!resp.body) {
            return done(new Error('dgv: No body'));
        }
        done(null, resp.body);
    });
}

function handleBasicRequest(req, done) {
    req.end(function (err, resp) {
        debug('%s %s %d', resp.req.method, resp.req.path, resp.status);
        if (err) return done(err);
        if (resp.error || !resp.body) {
            debug(resp.body);
            return done(new Error('dgv: Unexpected result'));
        }
        done(null, resp.body);
    });
}

exports.getProfile = function (accessToken, done) {
    handleAuthorizedRequest(
        request.get(rootUrl + '/me/'),
        accessToken,
        done
    );
};

exports.getOrganization = function (id, done) {
    handleBasicRequest(
        request.get(rootUrl + '/organizations/' + id),
        done
    );
};

exports.createDataset = function (dataset, accessToken, done) {
    var datasetId;
    async.series({
        creation: function (stepDone) {
            exports.createDatasetOnly(dataset, accessToken, function (err, datasetCreated) {
                if (err) return stepDone(err);
                datasetId = datasetCreated.id;
                stepDone(null, datasetCreated);
            });
        },
        resources: function (stepDone) {
            exports.updateDatasetResources(datasetId, dataset.resources, accessToken, stepDone);
        },
        completeDataset: function (stepDone) {
            exports.getDataset(datasetId, accessToken, stepDone);
        }
    }, function (err, result) {
        if (err) return done(err);
        done(null, result.completeDataset);
    });
};

exports.createDatasetOnly = function (dataset, accessToken, done) {
    handleAuthorizedRequest(
        request.post(rootUrl + '/datasets/').send(dataset),
        accessToken,
        done
    );
};

exports.addDatasetResources = function (datasetId, resources, accessToken, done) {
    async.eachSeries(resources, function (resource, stepDone) {
        exports.createDatasetResource(datasetId, resource, accessToken, stepDone);
    }, done);
};

exports.updateDataset = function (id, dataset, accessToken, done) {
    async.series({
        resources: function (stepDone) {
            exports.updateDatasetResources(id, dataset.resources, accessToken, stepDone);
        },
        dataset: function (stepDone) {
            exports.updateDatasetOnly(id, dataset, accessToken, stepDone);
        }
    }, function (err, result) {
        if (err) return done(err);
        done(null, result.dataset);
    });
};

exports.updateDatasetOnly = function (id, dataset, accessToken, done) {
    handleAuthorizedRequest(
        request.put(rootUrl + '/datasets/' + id + '/').send(dataset),
        accessToken,
        done
    );
};

exports.createDatasetResource = function (datasetId, resource, accessToken, done) {
    handleAuthorizedRequest(
        request.post(rootUrl + '/datasets/' + datasetId + '/resources/').send(resource),
        accessToken,
        done
    );
};

exports.deleteDatasetResource = function (datasetId, resourceId, accessToken, done) {
    handleAuthorizedRequest(
        request.del(rootUrl + '/datasets/' + datasetId + '/resources/' + resourceId + '/').set('content-length', 0),
        accessToken,
        done
    );
};

exports.getDataset = function (datasetId, accessToken, done) {
    handleAuthorizedRequest(
        request.get(rootUrl + '/datasets/' + datasetId + '/'),
        accessToken,
        done
    );
};

exports.getDatasetResources = function (id, accessToken, done) {
    exports.getDataset(id, accessToken, function (err, dataset) {
        if (err) return done(err);
        done(null, dataset.resources);
    });
};

exports.cleanDatasetResources = function (id, accessToken, done) {
    exports.getDatasetResources(id, accessToken, function (err, resources) {
        async.eachSeries(resources, function (resource, stepDone) {
            exports.deleteDatasetResource(id, resource.id, accessToken, stepDone);
        }, done);
    });
};

exports.updateDatasetResources = function (id, resources, accessToken, done) {
    async.series([
        function (stepDone) {
            exports.cleanDatasetResources(id, accessToken, stepDone);
        },
        function (stepDone) {
            exports.addDatasetResources(id, resources, accessToken, stepDone);
        }
    ], done);
};

exports.deleteDataset = function (id, accessToken, done) {
    handleAuthorizedRequest(
        request.del(rootUrl + '/datasets/' + id + '/').set('content-length', 0),
        accessToken,
        done
    );
};