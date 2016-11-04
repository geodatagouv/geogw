var mongoose = require('mongoose');
var async = require('async');
var _ = require('lodash');

var dgv = require('../udata');
var map = require('../mapping').map;

var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

var DatasetSchema = new Schema({
    _id: { type: String },

    // Attributes related to the publication on the udata platform
    publication: {
        // Unique ID on the udata platform
        _id: { type: String, unique: true, sparse: true },

        // Publication status: can be private or public
        status: { type: String, enum: ['private', 'public'] },

        // Organization on the udata platform which hold the dataset
        organization: { type: ObjectId, ref: 'Organization' },

        // Published dataset revision
        revision: { type: Date },

        withErrors: { type: Boolean },

        createdAt: { type: Date },
        updatedAt: { type: Date, index: true, sparse: true }
    }

});

DatasetSchema.methods = {

    fetchAndConvert: function (done) {
        var datasetRef = this;
        var ConsolidatedRecord = mongoose.model('ConsolidatedRecord');

        ConsolidatedRecord
            .findOne({ recordId: datasetRef._id })
            .exec(function (err, sourceDataset) {
                if (err) return done(err);
                if (!sourceDataset) return done(new Error('Record not found: ' + datasetRef._id));
                if (!sourceDataset.metadata) return done(new Error('Record found but empty metadata: ' + datasetRef._id));
                var uDataset;

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

    processSynchronization: function (type, done) {
        var datasetRef = this;

        async.parallel({
            uDataset: _.bind(datasetRef.fetchAndConvert, datasetRef),
            accessToken: _.bind(datasetRef.fetchWorkingAccessToken, datasetRef)
        }, function (err, context) {
            if (err) return done(err);
            if (!context.accessToken) return done(new Error('No working accessToken found'));

            function requestSyncCallback(err, publishedDataset, withErrors) {
                if (err) return done(err);

                var now = new Date();

                if (type === 'create') {
                    datasetRef
                        .set('publication.createdAt', now)
                        .set('publication._id', publishedDataset.id);
                }

                datasetRef
                    .set('publication.updatedAt', now)
                    .set('publication.withErrors', withErrors)
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
