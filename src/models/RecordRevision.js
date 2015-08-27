import { mongoose, Schema } from 'mongoose';
import sidekick from '../helpers/sidekick';

var _ = require('lodash');

var DistributionSchema = require('./schemas/distribution');
var facets = require('../helpers/facets');

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
    hashedRecord: { type: String, required: true, index: true },
    dateStamp: { type: Date },

    /* Content */
    metadata: { type: Mixed },
    identifier: { type: String, required: true }, // Can be removed since it clones metadata.identifier

    /* Dataset (preview) */
    dataset: {
        updatedAt: { type: Date, index: true, sparse: true },
        distributions: [DistributionSchema]
    },

    /* Augmented content */
    organizations: { type: [String], index: true },
    alternateResources: [Mixed],

    /* Facets */
    facets: { type: [Schema.Types.Mixed], select: false }
});

/*
** Indexes
*/
var textIndexOptions = {
    default_language: 'french',
    language_override: 'idioma', // To avoid conflict with `language` field of ISO-19139 JSON schema
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
        var query = _.pick(record, 'parentCatalog', 'hashedId', 'hashedRecord');
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
            $set: _.pick(record, 'metadata', 'dateStamp', 'hashedRecord')
        };

        this.update(query, changes, { upsert: true }, function (err, rawResponse) {
            if (err) return done(err);
            done(null, rawResponse.upserted ? 'created' : 'updated');
        });
    },

    triggerConsolidateAsDataset: function (record, done) {
        return sidekick(
            'dataset:consolidate',
            { hashedId: record.hashedId, catalogId: record.parentCatalog }
        ).nodeify(done);
    },

    upsert: function (record, done) {
        var Model = this;

        Model.touchExisting(record, function (err, touched) {
            if (err) return done(err);
            if (touched) return done(null, 'touched');

            Model.doUpsert(record, function (err, upsertStatus) {
                if (err) return done(err);

                sidekick('process-record', { hashedId: record.hashedId, catalogId: record.parentCatalog })
                    .then(() => done(null, upsertStatus), done);
            });
        });
    }

};


/*
** Methods
*/
RecordSchema.methods = {

    computeFacets: function () {
        return this.set('facets', facets.compute(this));
    }

};


/*
** Attach model
*/
mongoose.model('Record', RecordSchema);
