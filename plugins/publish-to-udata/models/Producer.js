const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const schema = new Schema({
    _id: String,
    associatedTo: { type: ObjectId, ref: 'Organization', index: true }
});

mongoose.model('Producer', schema);
