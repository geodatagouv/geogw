/*eslint no-multi-spaces: 0, key-spacing: 0 */
import mongoose from 'mongoose';
import { Schema } from 'mongoose';


export const collectionName = 'consolidated_organizations';

/* Schema */
export const schema = new Schema({

    name: { type: String },
    slug: { type: String, unique: true, sparse: true },
    keywords: { type: [String], index: true }

});

/* Declare as model */
export const model = mongoose.model('ConsolidatedOrganization', schema, collectionName);
