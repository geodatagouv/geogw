/*
** Module dependencies
*/
var mongoose = require('mongoose');

var Schema = mongoose.Schema;


/*
** Schema
*/
var CswRecordSchema = new Schema({
    identifier: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true },
    parentCatalog: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    synchronizations: [{ type: Schema.Types.ObjectId, ref: 'ServiceSync', index: true }],
    availableSince: { type: Schema.Types.ObjectId, ref: 'ServiceSync', index: true },
    removedSince: { type: Schema.Types.ObjectId, ref: 'ServiceSync', index: true },
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
