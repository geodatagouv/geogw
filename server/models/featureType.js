/*
** Module dependencies
*/
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

/*
** FeatureType schema
*/
var FeatureTypeSchema = new Schema({
    service: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    lastSync: { type: Schema.Types.ObjectId, ref: 'ServiceSync', required: true },
    name: { type: String, required: true },
    title: String,
    abstract: String,
    keywords: [String]
});

/*
** Indexes
*/
FeatureTypeSchema.index({ service: 1, name: 1 }, { unique: true } );

/*
** Attach model
*/
mongoose.model('FeatureType', FeatureTypeSchema);