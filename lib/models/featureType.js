var mongoose = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

var FeatureTypeSchema = new Schema({
    // Parent service
    service: { type: ObjectId, ref: 'Service', index: true },

    // Feature type name
    name: { type: String, required: true, index: true },

    // Status
    available: { type: Boolean, required: true, index: true },
    checking: { type: Boolean, index: true, select: false },
    // lastCheck
    // lastAvailabilityStatusUpdate

    // Metadata
    title: { type: String },
    abstract: { type: String },
    keywords: { type: [String] }
});

FeatureTypeSchema.index({ service: 1, name: 1 }, { unique: true } );

mongoose.model('FeatureType', FeatureTypeSchema);
