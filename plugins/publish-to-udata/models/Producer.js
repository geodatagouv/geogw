var mongoose = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

var ProducerSchema = new Schema({
    _id: String,
    _created: Date,

    /* Configuration */
    associatedTo: { type: ObjectId, ref: 'Organization', index: true }

});

mongoose.model('Producer', ProducerSchema);
