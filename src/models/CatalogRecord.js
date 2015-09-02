/*eslint no-multi-spaces: 0, key-spacing: 0 */
import mongoose from 'mongoose';
import { Schema } from 'mongoose';
import pick from 'lodash/object/pick';

const ObjectId = Schema.Types.ObjectId;


export const collectionName = 'catalog_records';

/* Schema */
export const schema = new Schema({

    /* Identification */
    catalogId:      { type: ObjectId,  required: true },
    recordId:       { type: String,    required: true },

    /* Attributes */
    recordHash:     { type: String,    required: true },
    revisionDate:   { type: Date },

    /* Dates */
    createdAt:      { type: Date },
    touchedAt:      { type: Date },
    updatedAt:      { type: Date }

});

/* Indexes */
schema.index({ catalogId: 1, recordId: 1 }, { unique: true });

/* Statics */
schema.statics = {

    touchExisting: function (catalogRecord) {
        const now = new Date();
        const query = pick(catalogRecord, 'catalogId', 'recordId', 'recordHash');
        const changes = { $set: { touchedAt: now } };

        return this.update(query, changes)
            .then(rawResponse => rawResponse.nModified === 1);
    },

    doUpsert: function (catalogRecord) {
        const now = new Date();
        const query = pick(catalogRecord, 'catalogId', 'recordId');
        var changes = {
            $setOnInsert: { createdAt: now },
            $set: {
                recordHash: catalogRecord.recordHash,
                revisionDate: catalogRecord.revisionDate,
                updatedAt: now,
                touchedAt: now
            }
        };

        return this.update(query, changes, { upsert: true })
            .then(rawResponse => rawResponse.upserted ? 'created' : 'updated');
    },

    upsert: function (catalogRecord) {
        return this
            .touchExisting(catalogRecord)
            .then(touched => touched ? 'touched' : this.doUpsert(catalogRecord))
            .then(upsertStatus => {
                if (upsertStatus === 'touched') return 'touched';
                return mongoose.model('ConsolidatedRecord').triggerUpdated(catalogRecord.recordId).return(upsertStatus);
            });
    }

};

/* Declare as model */
export const model = mongoose.model('CatalogRecord', schema, collectionName);
