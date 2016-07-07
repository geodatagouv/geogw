/*eslint no-multi-spaces: 0, key-spacing: 0 */
const mongoose = require('mongoose');
const { Schema } = require('mongoose');


const collectionName = 'consolidated_organizations';

/* Schema */
const schema = new Schema({

    name: { type: String },
    slug: { type: String, unique: true, sparse: true },
    keywords: { type: [String], index: true }

});

/* Declare as model */
const model = mongoose.model('ConsolidatedOrganization', schema, collectionName);

module.exports = { model, collectionName, schema };
