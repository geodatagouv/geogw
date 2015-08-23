var mongoose = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

var DISTRIBUTION_TYPES = [
    'wfs-featureType',
    'file-package'
];

var DistributionSchema = new Schema({
    type: { type: String, enum: DISTRIBUTION_TYPES, required: true },
    service: { type: ObjectId, ref: 'Service' },

    name: { type: String }, // distribution label

    available: { type: Boolean },

    /* FeatureType */
    typeName: { type: String },

    /* File package */
    location: { type: String },
    hashedLocation: { type: String },
    layer: { type: String }
});

module.exports = DistributionSchema;
