import mongoose from 'mongoose';
import { Schema } from 'mongoose';
import sidekick from '../helpers/sidekick';
import pick from 'lodash/object/pick';

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

    touchExisting: function (record) {
        const query = pick(record, 'parentCatalog', 'hashedId', 'hashedRecord');
        const changes = { $currentDate: { touchedAt: 1 } };

        return this.update(query, changes)
            .then(rawResponse => rawResponse.nModified === 1);
    },

    doUpsert: function (record) {
        var query = pick(record, 'parentCatalog', 'hashedId');
        var changes = {
            $currentDate: { updatedAt: 1, touchedAt: 1 },
            $setOnInsert: pick(record, 'identifier'),
            $set: pick(record, 'metadata', 'dateStamp', 'hashedRecord')
        };

        return this.update(query, changes, { upsert: true })
            .then(rawResponse => rawResponse.upserted ? 'created' : 'updated');
    },

    triggerConsolidateAsDataset: function (record) {
        return sidekick('dataset:consolidate', {
            hashedId: record.hashedId,
            catalogId: record.parentCatalog
        });
    },

    triggerProcess: function (record) {
        return sidekick('process-record', {
            hashedId: record.hashedId,
            catalogId: record.parentCatalog
        });
    },

    upsert: function (record) {
        return this
            .touchExisting(record)
            .then(touched => touched ? 'touched' : this.doUpsert(record))
            .then(upsertStatus => {
                if (upsertStatus === 'touched') return 'touched';
                return this.triggerProcess(record).return(upsertStatus);
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
