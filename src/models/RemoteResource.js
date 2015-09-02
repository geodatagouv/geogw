import mongoose from 'mongoose';
import { Schema } from 'mongoose';
import pick from 'lodash/object/pick';
import sidekick from '../helpers/sidekick';
import { sha1 } from '../helpers/hash';

const Mixed = Schema.Types.Mixed;


export const REMOTE_RESOURCE_TYPES = [
    'page',
    'file-distribution',
    'unknown-archive'
];


export const schema = new Schema({

    location: { type: String, required: true, unique: true },
    hashedLocation: { type: String, required: true, unique: true },

    createdAt: { type: Date },
    touchedAt: { type: Date, index: true },
    updatedAt: { type: Date, index: true },

    type: { type: String, enum: REMOTE_RESOURCE_TYPES, index: true },
    available: { type: Boolean, index: true, sparse: true },

    checkResult: { type: Mixed },

    file: {
        digest: { type: String },
        length: { type: Number },
        downloadedAt: { type: Date },
        dropped: { type: Boolean }
    },

    archive: {
        files: [String],
        datasets: [String]
    }

});


/*
** Helpers
*/


/*
** Statics
*/
schema.statics = {

    triggerCheck: function (remoteResource) {
        return sidekick(
            'remote-resource:check',
            {
                remoteResourceId: remoteResource._id,
                remoteResourceLocation: remoteResource.location
            },
            { removeOnComplete: true }
        );
    },

    upsert: function (remoteResource) {
        var RemoteResource = this;

        var now = new Date();
        var aLongTimeAgo = new Date(1970, 1, 1);
        var query = pick(remoteResource, 'location');
        var changes = {
            $setOnInsert: {
                createdAt: now,
                touchedAt: aLongTimeAgo,
                updatedAt: aLongTimeAgo,
                hashedLocation: sha1(query.location)
            }
        };

        if (remoteResource.type) {
            changes.$setOnInsert.type = remoteResource.type;
        }

        return RemoteResource.update(query, changes, { upsert: true })
            .then(rawResponse => {
                if (!rawResponse.upserted) return false;
                remoteResource._id = rawResponse.upserted[0]._id;
                return this.triggerCheck(remoteResource).return(true);
            });
    }

};

export const collectionName = 'remote_resources';
export const model = mongoose.model('RemoteResource', schema, collectionName);
