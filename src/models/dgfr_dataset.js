var mongoose = require('mongoose');
var async = require('async');
var _ = require('lodash');

var dgv = require('../dgfr/api');
var map = require('../dgfr/mapping').map;

var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

var DatasetSchema = new Schema({
    _id: { type: String },
    hashedId: String, // TEMP

    // Last known title
    title: { type: String }, // May be overriden by alternative revision

    // Last known producers
    producers: { type: [String] }, // May be overriden by alternative revision

    // Attributes related to the publication on the udata platform
    publication: {
        // Unique ID on the udata platform
        _id: { type: String, unique: true, sparse: true },

        // Publication status: can be private or public
        status: { type: String, enum: ['private', 'public'] },

        // Organization on the udata platform which hold the dataset
        organization: { type: ObjectId, ref: 'Organization' },

        // Source catalog on the geogw platform from which the dataset is synced
        sourceCatalog: { type: ObjectId },

        // Published dataset revision
        revision: { type: Date },

        updatedAt: { type: Date, index: true, sparse: true }
    },

    // List of organizations for which the dataset is matching criteria
    matchingFor: [{ type: ObjectId, ref: 'Organization' }]

});

DatasetSchema.methods = {

    fetchAndConvert: function (done) {
        var datasetRef = this;
        var Record = mongoose.model('Record');

        Record
            .findOne({ hashedId: datasetRef._id, parentCatalog: datasetRef.publication.sourceCatalog })
            .exec(function (err, sourceDataset) {
                if (err) return done(err);
                var uDataset;

                datasetRef
                    .set('title', sourceDataset.metadata.title)
                    .set('producers', sourceDataset.organizations);

                try {
                    uDataset = map(sourceDataset);
                    uDataset.organization = datasetRef.publication.organization;
                    uDataset.private = datasetRef.publication.status !== 'public';
                } catch (e) {
                    return done(e);
                }

                done(null, uDataset);
            });
    },

    fetchWorkingAccessToken: function (done) {
        var Organization = mongoose.model('Organization');
        var organization = new Organization({ _id: this.publication.organization });
        organization.fetchWorkingAccessToken(done);
    },

    processSynchronization: function (type, done) {
        var datasetRef = this;

        async.parallel({
            uDataset: _.bind(datasetRef.fetchAndConvert, datasetRef),
            accessToken: _.bind(datasetRef.fetchWorkingAccessToken, datasetRef)
        }, function (err, context) {
            if (err) return done(err);
            if (!context.accessToken) return done(new Error('No working accessToken found'));

            function requestSyncCallback(err, publishedDataset) {
                if (err) return done(err);

                var now = new Date();

                if (type === 'create') {
                    datasetRef
                        // .set('_created', now)
                        .set('publication._id', publishedDataset.id);
                }

                datasetRef
                    .set('updatedAt', now)
                    .save(done);
            }

            if (type === 'create') {
                dgv.createDataset(context.uDataset, context.accessToken, requestSyncCallback);
            } else if (type === 'update') {
                dgv.updateDataset(datasetRef.publication._id, context.uDataset, context.accessToken, requestSyncCallback);
            } else {
                throw new Error('Unknown type for processSynchronization');
            }
        });
    },

    synchronize: function (done) {
        this.processSynchronization('update', done);
    },

    publish: function (done) {
        this.processSynchronization('create', done);
    },

    unpublish: function (done) {
        var datasetRef = this;

        datasetRef.fetchWorkingAccessToken(function (err, accessToken) {
            if (err) return done(err);
            if (!accessToken) return done(new Error('No working accessToken found'));

            dgv.deleteDataset(datasetRef.publication._id, accessToken, function (err) {
                if (err) return done(err);
                datasetRef.set('publication', undefined).save(done);
            });
        });
    }

};

mongoose.model('Dataset', DatasetSchema);
