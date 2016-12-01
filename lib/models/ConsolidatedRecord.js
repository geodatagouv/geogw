/*eslint no-multi-spaces: 0, key-spacing: 0 */
const mongoose = require('mongoose');
const { Schema } = require('mongoose');
const sidekick = require('../helpers/sidekick');
const DistributionSchema = require('./schemas/distribution');

const ObjectId = Schema.Types.ObjectId;
const Mixed = Schema.Types.Mixed;


const collectionName = 'consolidated_records';

const schema = new Schema({

    /* Identification */
    recordId:              { type: String,     required: true, unique: true },

    /* Attributes */
    recordHash:            { type: String,     required: true },
    revisionDate:          { type: Date },

    /* Catalogs */
    catalogs:             [{ type: ObjectId, ref: 'Service', index: true }],

    /* Publications */
    publications:         [Mixed],

    /* Content */
    metadata:              { type: Mixed },
    dataset: {
        updatedAt:         { type: Date, index: true, sparse: true },
        distributions:     [DistributionSchema]
    },
    organizations:         { type: [String], index: true },
    alternateResources:    [Mixed],

    /* Facets */
    facets:                { type: [Mixed],   select: false },

    /* Dates */
    createdAt:             { type: Date }
});

/* Indexes */
schema.index({ 'facets.name': 1, 'facets.value': 1 });

const textIndexOptions = {
    default_language: 'french',
    language_override: 'idioma', // To avoid conflict with `language` field of ISO-19139 JSON schema
    name: 'default_text_index',
    weights: {
        'metadata.title': 10,
        'metadata.keywords': 5,
        'metadata.abstract': 2
    }
};

const textIndexDefinition = {
    'metadata.title': 'text',
    'metadata.abstract': 'text',
    'metadata.keywords': 'text'
};

schema.index(textIndexDefinition, textIndexOptions);

/* Statics */
schema.statics = {

    triggerUpdated: function (recordId) {
        return sidekick('dataset:consolidate', { recordId });
    }

};

/* Declare as model */
const model = mongoose.model('ConsolidatedRecord', schema, collectionName);

module.exports = { model, collectionName, schema };
