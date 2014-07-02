/*
** Module dependencies
*/
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

/*
** FeatureType schema
*/
var FeatureTypeSchema = new Schema({
    service: { type: Schema.Types.ObjectId, ref: 'Service' },
    name: String,
    title: String,
    abstract: String,
    keywords: [String]
});

/*
** Attach model
*/
mongoose.model('FeatureType', FeatureTypeSchema);