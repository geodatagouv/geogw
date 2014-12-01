/*
** Module dependencies
*/
var mongoose = require('mongoose');

var Schema = mongoose.Schema;


/*
** Schema
*/
var CswRecordSchema = new Schema({
    identifier: { type: String, required: true },
    timestamp: { type: Date, required: true },
    parentCatalog: { type: Schema.Types.ObjectId, ref: 'Service' },
    synchronizations: { type: [Schema.Types.ObjectId], ref: 'ServiceSync' },
    xml: String
});

/*
** Index
*/
CswRecordSchema.index({ identifier: 1, timestamp: 1, parentCatalog: 1 }, { unique: true });


/*
** Attach model
*/
mongoose.model('CswRecord', CswRecordSchema);
