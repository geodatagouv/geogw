/*eslint no-multi-spaces: 0, key-spacing: 0 */
const mongoose = require('mongoose');
const { Schema } = require('mongoose');

const ObjectId = Schema.Types.ObjectId;


const collectionName = 'organization_spellings';

/* Schema */
const schema = new Schema({

    /* Identification */
    _id: { type: String },
    organization: { type: ObjectId, index: true, sparse: true, ref: 'ConsolidatedOrganization' },

    /* Misspelled */
    misspelled: { type: Boolean },

    /* Rejection */
    rejected: { type: Boolean },
    rejectionReason: { type: String }

});

/* Declare as model */
const model = mongoose.model('OrganizationSpelling', schema, collectionName);

module.exports = { model, collectionName, schema };
