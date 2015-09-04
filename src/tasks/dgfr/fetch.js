var mongoose = require('mongoose');
var async = require('async');
var debug = require('debug')('dgv:fetch');

// var q = require('../config/kue');
var search = require('../../helpers/search');

var Organization = mongoose.model('Organization');
var Producer = mongoose.model('Producer');
var Dataset = mongoose.model('Dataset');

module.exports = function (job, jobDone) {
    var organizationId = job.data.organizationId;

    var organization, producers;

    function fetchOrganization(done) {
        Organization.findById(organizationId, function (err, organizationFound) {
            if (err) return done(err);
            if (!organizationFound) return done(new Error('Organization not found'));
            organization = organizationFound;
            done();
        });
    }

    function fetchProducers(done) {
        Producer.find({ associatedTo: organizationId }).exec(function (err, producersFound) {
            if (err) return done(err);
            if (producersFound.length === 0) debug('No associated producers');
            producers = producersFound;
            done();
        });
    }

    function cleanMatchingDatasets(done) {
        var query = { matchingFor: organizationId };
        var updateOperations = { $pull: { matchingFor: organizationId } };
        Dataset.update(query, updateOperations, { multi: true }, function (err) {
            if (err) {
                debug('Unable to clean matching datasets for %s: an error has occurred', organizationId);
                return done(err);
            }
            debug('Matching datasets for %s successfully cleaned', organizationId);
            done();
        });
    }

    function fetchAndSaveDatasets(done) {
        var datasetsProcessed = {};

        function fetchAndProcessByProducer(producer, producerDone) {
            var query = {
                limit: 500,
                opendata: 'yes',
                availability: 'yes',
                organization: producer._id,
                catalog: organization.sourceCatalog
            };

            search(query, function (err, result) {
                if (err) return producerDone(err);
                debug('%d datasets found for producer `%s`', result.count, producer._id);

                async.eachLimit(result.results, 20, function (dataset, datasetDone) {
                    if (dataset.recordId in datasetsProcessed) {
                        debug('Dataset %s already processed', dataset.recordId);
                        datasetDone();
                    } else {
                        datasetsProcessed[dataset.recordId] = true;

                        var updateOperations = {
                            $push: { matchingFor: organizationId },
                            $set: { title: dataset.metadata.title, producers: dataset.organizations }
                        };
                        var opts = { upsert: true };

                        Dataset.findByIdAndUpdate(dataset.recordId, updateOperations, opts, function (err) {
                            if (err) {
                                debug('Unable to upsert matching dataset %s', dataset.recordId);
                                return datasetDone(err);
                            }
                            datasetDone();
                        });

                        // q.create('dgv:publish', { datasetId: dataset.recordId, organizationId: organizationId })
                        //     .attempts(5)
                        //     .removeOnComplete(true)
                        //     .save(function () {
                        //         debug('Dataset %s added to queue', dataset.recordId);
                        //         datasetDone();
                        //     });
                    }
                }, producerDone);
            });
        }

        async.eachLimit(producers, 5, fetchAndProcessByProducer, done);
    }

    async.series([
        fetchOrganization,
        fetchProducers,
        cleanMatchingDatasets,
        fetchAndSaveDatasets
    ], jobDone);

};
