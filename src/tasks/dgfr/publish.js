var mongoose = require('mongoose');
var async = require('async');
var debug = require('debug')('dgv:publish');

var Dataset = mongoose.model('Dataset');

module.exports = function (job, jobDone) {
    var datasetId = job.data.datasetId;
    var organizationId = job.data.organizationId;
    var sourceCatalog = job.data.sourceCatalog;
    var publicationStatus = job.data.publicationStatus;

    var dataset;

    function fetchAssoc(done) {
        Dataset.findById(datasetId, function (err, datasetFound) {
            if (err) return done(err);
            if (!datasetFound) return done(new Error('Dataset not found'));
            dataset = datasetFound;
            done();
        });
    }

    function createOrUpdate(done) {
        if (dataset.publication.organization) {
            if (dataset.publication.organization.equals(organizationId)) {
                debug('Going to update an existing dataset : %s', dataset.publication._id);
                return dataset.synchronize(done);
            } else {
                debug('OrganizationId mismatch: ignored');
                return done(new Error('OrganizationId mismatch: ignored'));
            }
        } else {
            debug('Going to publish a new dataset');
            dataset
                .set('publication.sourceCatalog', sourceCatalog)
                .set('publication.organization', organizationId)
                .set('publication.status', publicationStatus)
                .publish(done);
        }
    }

    async.series([fetchAssoc, createOrUpdate], jobDone);
};
