/*
** Module dependencies
*/
var mongoose = require('mongoose');

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
** Attach model
*/
mongoose.model('Record', RecordSchema);
