/*
** Module dependencies
*/
var mongoose = require('mongoose');
var iso19139 = require('iso19139');
var libxml = require('libxmljs');

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
    xml: String,
    parsed: Boolean,
    parsedValue: Schema.Types.Mixed
});

/*
** Index
*/
CswRecordSchema.index({ identifier: 1, timestamp: 1, parentCatalog: 1 }, { unique: true });


/*
** Methods
*/
CswRecordSchema.methods = {
    parseXml: function (cb) {
        var xmlElement;
        try {
            xmlElement = libxml.parseXml(this.xml, { noblanks: true });
        } catch (ex) {
            return cb(ex);
        }
        this.parsed = true;
        this.parsedValue = iso19139.parse(xmlElement.root());
        cb(null, this.parsedValue);
    }
};


/*
** Attach model
*/
mongoose.model('CswRecord', CswRecordSchema);
