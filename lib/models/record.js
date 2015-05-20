/*
** Module dependencies
*/
var mongoose = require('mongoose');
var _ = require('lodash');

var jobs = require('../kue').jobs;

var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;
var Mixed = Schema.Types.Mixed;

/*
** Record schema
*/
var RecordSchema = new Schema({

    /* Synchronization */
    parentCatalog: { type: ObjectId, ref: 'Service', required: true, index: true },
    updatedAt: { type: Date, required: true, index: true },
    touchedAt: { type: Date, required: true },

    /* Identification */
    hashedId: { type: String, required: true, index: true },
    dateStamp: { type: Date, index: true },

    /* Content */
    metadata: { type: Mixed },
    identifier: { type: String, required: true }, // Can be removed since it clones metadata.identifier

    /* Augmented content */
    organizations: { type: [String], index: true },

    /* Facets */
    facets: { type: [Schema.Types.Mixed], select: false }
});

/*
** Indexes
*/
var textIndexOptions = {
    default_language: 'french',
    name: 'default_text_index',
    weights: {
        'metadata.title': 10,
        'metadata.keywords': 5,
        'metadata.abstract': 2
    }
};

var textIndexDefinition = {
    'metadata.title': 'text',
    'metadata.abstract': 'text',
    'metadata.keywords': 'text'
};

RecordSchema.index(textIndexDefinition, textIndexOptions);

RecordSchema.index({ 'facets.name': 1, 'facets.value': 1 });
RecordSchema.index({ parentCatalog: 1, hashedId: 1 }, { unique: true });

/*
** Statics
*/
RecordSchema.statics = {

    touchExisting: function (record, done) {
        var query = _.pick(record, 'parentCatalog', 'hashedId', 'dateStamp');
        var changes = { $currentDate: { touchedAt: 1 } };

        this.update(query, changes, function (err, rawResponse) {
            if (err) return done(err);
            var touched = rawResponse.nModified === 1;
            done(null, touched);
        });
    },

    doUpsert: function (record, done) {
        var query = _.pick(record, 'parentCatalog', 'hashedId');
        var changes = {
            $currentDate: { updatedAt: 1, touchedAt: 1 },
            $setOnInsert: _.pick(record, 'identifier'),
            $set: _.pick(record, 'metadata', 'dateStamp')
        };

        this.update(query, changes, { upsert: true }, function (err, rawResponse) {
            if (err) return done(err);
            done(null, rawResponse.upserted ? 'created' : 'updated');
        });
    },

    triggerProcessRecord: function (record, done) {
        jobs
            .create('process-record', {
                hashedId: record.hashedId,
                catalogId: record.parentCatalog
            })
            .removeOnComplete(true)
            .attempts(5)
            .save(done);
    },

    upsert: function (record, done) {
        var Model = this;

        Model.touchExisting(record, function (err, touched) {
            if (err) return done(err);
            if (touched) return done(null, 'touched');

            Model.doUpsert(record, function (err, upsertStatus) {
                if (err) return done(err);

                Model.triggerProcessRecord(record, function (err) {
                    if (err) console.log(err);

                    done(null, upsertStatus);
                });
            });
        });
    }

};


/*
** Attach model
*/
mongoose.model('Record', RecordSchema);
