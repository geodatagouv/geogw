var mongoose = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

var ORIGIN_TYPES = [
    'srv:coupledResource',
    'gmd:onLine'
];

var RESOURCE_TYPES = [
    'feature-type',
    'link',
    'atom-feed'
];

var RelatedResourceSchema = new Schema({

    type: { type: String, required: true, index: true, enum: RESOURCE_TYPES },

    updatedAt: { type: Date, required: true, index: true },
    // touchedAt: { type: Date, required: true },

    name: { type: String },

    /* Origin */
    originType: { type: String, enum: ORIGIN_TYPES, required: true, index: true },
    originId: { type: ObjectId, required: true, index: true },
    originCatalog: { type: ObjectId, ref: 'Service', index: true, sparse: true },

    /* Record */
    record: { type: String, required: true, index: true },

    /* FeatureType */
    featureType: {
        candidateName: { type: String },
        candidateLocation: { type: String },
        matchingName: { type: String, index: true, sparse: true },
        matchingService: { type: ObjectId, index: true, sparse: true }
    }

    /*  */
});

mongoose.model('RelatedResource', RelatedResourceSchema);
