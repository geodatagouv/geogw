/*eslint no-multi-spaces: 0, key-spacing: 0 */
import mongoose from 'mongoose';
import { Schema } from 'mongoose';
import Promise from 'bluebird';
import pick from 'lodash/object/pick';
import magicGet from 'lodash/object/get';
import { resolveByRelatedResource } from '../matching/featureTypes';
import { sha1 } from '../helpers/hash';

const resolveByRelatedResourceAsync = Promise.promisify(resolveByRelatedResource);

const ObjectId = Schema.Types.ObjectId;

export const ORIGIN_TYPES = [
    'srv:coupledResource',
    'gmd:onLine'
];

export const RESOURCE_TYPES = [
    'feature-type',
    'remote-resource',
    'atom-feed'
];

export const REMOTE_RESOURCE_TYPES = [
    'page',
    'file-distribution',
    'unknown-archive'
];

export const collectionName = 'related_resources';

export const schema = new Schema({

    type: { type: String, required: true, index: true, enum: RESOURCE_TYPES },

    updatedAt: { type: Date, required: true, index: true },
    checking: { type: Boolean, index: true, sparse: true, select: false },

    name: { type: String },

    /* Origin */
    originType: { type: String, enum: ORIGIN_TYPES, required: true, index: true },
    originId: { type: String, required: true, index: true },
    originHash: { type: String, index: true, sparse: true },

    /* Record identification */
    record: { type: String, required: true, index: true },

    /* FeatureType */
    featureType: {
        candidateName: { type: String },
        candidateLocation: { type: String },
        matchingName: { type: String, index: true, sparse: true },
        matchingService: { type: ObjectId, index: true, sparse: true }
    },

    /* RemoteResource */
    remoteResource: {
        location: { type: String, index: true, sparse: true },
        hashedLocation: { type: String, index: true, sparse: true },
        type: { type: String, enum: REMOTE_RESOURCE_TYPES },
        available: { type: Boolean },
        layers: { type: [String] }
    }

});


/*
** Statics
*/
schema.statics = {

    markAsChecking: function (query) {
        return this.update(query, { $set: { checking: true } }, { multi: true });
    },

    triggerConsolidation: function (relatedResource) {
        if (!relatedResource.record) throw new Error('record not found in RelatedResource');
        return mongoose.model('ConsolidatedRecord').triggerUpdated(relatedResource.record);
    },

    validateRemoteResource: function (relatedResource) {
        return relatedResource.remoteResource && relatedResource.remoteResource.location;
    },

    getUniqueQuery: function (relatedResource) {
        const query = pick(relatedResource, 'originType', 'originId', 'originHash', 'record');
        if (relatedResource.remoteResource) {
            query.type = 'remote-resource';
            query['remoteResource.location'] = relatedResource.remoteResource.location;
        } else if (relatedResource.featureType) {
            query.type = 'feature-type';
            query['featureType.candidateName'] = relatedResource.featureType.candidateName;
            query['featureType.candidateLocation'] = relatedResource.featureType.candidateLocation;
        } else {
            throw new Error('Unknown RelatedResource type');
        }
        return query;
    },

    upsert: function (relatedResource) {
        const r = relatedResource;

        if (!r.originHash || !r.originType || !r.originId) throw new Error('Bad RelatedResource origin');
        if (!r.record) throw new Error('record not defined');

        if (r.remoteResource) {
            return this.upsertRemoteResource(relatedResource);
        } else if (r.featureType) {
            return this.upsertFeatureType(relatedResource);
        } else {
            throw new Error('Unknown RelatedResource format');
        }
    },

    // Fetch data from a RemoteResource and apply to the given relatedResource
    updateRemoteResource: function (relatedResource, remoteResourceLocation) {
        return mongoose.model('RemoteResource').findOne({ location: remoteResourceLocation }).exec()
            .then(remoteResource => {
                if (!remoteResource) throw new Error('No RemoteResource found for remoteResourceLocation: ' + remoteResourceLocation);
                const changes = {
                    'remoteResource.available': remoteResource.available,
                    'remoteResource.type': remoteResource.type,
                    'remoteResource.layers': magicGet(remoteResource, 'archive.datasets', [])
                };
                return this.doUpdate(relatedResource, changes)
                    .return(true);
            });
    },

    updateFeatureType: function (relatedResource, candidateService) {
        return mongoose.model('Service').findOne(candidateService).exec()
            .then(service => {
                if (!service) throw new Error('No Service found for: ' + candidateService.toJSON());
                const changes = {
                    'featureType.matchingService': service._id
                };
                return this.doUpdate(relatedResource, changes)
                    .then(updated => {
                        if (updated) return resolveByRelatedResourceAsync(relatedResource).return(true);
                        return true;
                    });
            });
    },

    upsertRemoteResource: function (relatedResource) {
        const r = relatedResource;
        if (!this.validateRemoteResource(r)) throw new Error('Bad remoteResource description');

        /* Changes */
        const partialChanges = { $setOnInsert: { 'remoteResource.hashedLocation': sha1(r.remoteResource.location) } };
        if (r.name) partialChanges.$setOnInsert.name = r.name;
        if (r.remoteResource.type) partialChanges.$setOnInsert['remoteResource.type'] = r.remoteResource.type;

        return this.doUpsert(relatedResource, partialChanges)
            .then(upsertStatus => {
                if (upsertStatus === 'created') {
                    mongoose.model('RemoteResource').upsert(r.remoteResource)
                        .then(created => {
                            if (created) return upsertStatus;
                            return this.updateRemoteResource(relatedResource, r.remoteResource.location);
                        });
                }
                return upsertStatus;
            });
    },

    doUpdate: function (relatedResource, additionalChanges) {
        const query = this.getUniqueQuery(relatedResource);
        const changes = additionalChanges;
        if (!changes.$set) changes.$set = {};
        changes.$set.updatedAt = new Date();

        return this.update(query, changes)
            .then(rawResponse => rawResponse.nModified === 1);
    },

    doUpsert: function (relatedResource, additionalChanges = {}) {
        const query = this.getUniqueQuery(relatedResource);
        const changes = additionalChanges;
        if (!changes.$set) changes.$set = {};
        if (!changes.$setOnInsert) changes.$setOnInsert = {};
        changes.$set.checking = false;
        changes.$setOnInsert.updatedAt = new Date();

        return this.update(query, changes, { upsert: true })
            .then(rawResponse => rawResponse.upserted ? 'created' : 'updated');
    },

    validateFeatureType: function (r) {
        return r.featureType && r.featureType.candidateName && r.featureType.candidateLocation;
    },

    upsertFeatureType: function (relatedResource) {
        var r = relatedResource;

        if (!this.validateRemoteResource(r)) throw new Error('Bad featureType description');

        return this.doUpsert(relatedResource)
            .then(upsertStatus => {
                if (upsertStatus === 'created') {
                    const candidateService = {
                        location: relatedResource.featureType.candidateLocation,
                        protocol: 'wfs'
                    };
                    return mongoose.model('Service').upsert(candidateService)
                        .then(serviceUpsertStatus => {
                            if (serviceUpsertStatus === 'created') return upsertStatus;
                            return this.updateFeatureType(relatedResource, candidateService);
                        });
                }
                return upsertStatus;
            });
    }

};

export const model = mongoose.model('RelatedResource', schema, collectionName);
