/*eslint no-multi-spaces: 0, key-spacing: 0 */
import mongoose from 'mongoose';
import { Schema } from 'mongoose';

const ObjectId = Schema.Types.ObjectId;


export const collectionName = 'organization_spellings';

/* Schema */
export const schema = new Schema({

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
export const model = mongoose.model('OrganizationSpelling', schema, collectionName);
