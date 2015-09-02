import mongoose from 'mongoose';
import { Schema } from 'mongoose';
import pick from 'lodash/object/pick';
import keys from 'lodash/object/keys';
import sidekick from '../helpers/sidekick';
import Promise from 'bluebird';

import csw from './serviceTypes/csw';
import wfs from './serviceTypes/wfs';
import wms from './serviceTypes/wms';

export const supportedProtocols = { csw: csw, wfs: wfs, wms: wms };

export const SYNC_STATUSES = ['new', 'successful', 'failed'];

export const schema = new Schema({

    location: { type: String, required: true },
    protocol: { type: String, enum: keys(supportedProtocols), required: true },

    /* Context */
    name: { type: String, trim: true },
    abstract: { type: String },
    keywords: { type: [String] },

    /* Synchronization */
    sync: {
        status: { type: String, enum: SYNC_STATUSES, index: true, required: true },
        pending: { type: Boolean },
        processing: { type: Boolean },
        itemsFound: { type: Number },
        finishedAt: { type: Date, index: true }
    },

    syncEnabled: { type: Boolean, default: true }
});


/*
** Statics
*/
schema.statics = {

    setAsPending: function (serviceId) {
        const query = {
            _id: serviceId,
            syncEnabled: true,
            'sync.pending': false,
            'sync.processing': false
        };

        const changes = {
            $set: { 'sync.pending': true }
        };

        return this.update(query, changes).then(rawResponse => rawResponse.nModified === 1);
    },

    triggerSync: function (serviceId, freshness = 0) {
        let syncTask;

        return this.findById(serviceId).exec()
            .then(service => {
                if (!service) throw new Error('service not found for id: ' + serviceId);
                syncTask = supportedProtocols[service.protocol].syncTask;
                return service;
            })
            .then(service => {
                // Pre-check part should be moved into the sync task
                const minFinishedAtAcceptable = new Date(Date.now() - freshness);

                if (service.sync && service.sync.finishedAt && service.sync.finishedAt > minFinishedAtAcceptable) {
                    return 'ignored'; // fresh
                }

                return this.setAsPending(serviceId)
                    .then(ok => ok ? 'ready' : 'ignored');
            })
            .then(status => {
                if (status === 'ready') {
                    return Promise.resolve()
                        .then(() => mongoose.model('ServiceSync').create({ service: serviceId, status: 'queued' }))
                        .then(() => sidekick(
                            syncTask,
                            { serviceId, freshness },
                            { removeOnComplete: process.env.NODE_ENV === 'production' }
                        ))
                        .return('queued');
                }
                return status;
            });
    },

    upsert: function (service) {
        if (!service.protocol) throw new Error('protocol is not defined');
        if (!service.location) throw new Error('location is not defined');

        const query = pick(service, 'location', 'protocol');

        const changes = {
            $setOnInsert: {
                syncEnabled: true,
                sync: {
                    status: 'new',
                    processing: false,
                    pending: false,
                    finishedAt: new Date(1970)
                }
            }
        };

        return this.update(query, changes, { upsert: true })
            .then(rawResponse => {
                if (rawResponse.upserted) {
                    return this.triggerSync(rawResponse.upserted[0]._id).return('created');
                } else {
                    return this.triggerSync(rawResponse.upserted[0]._id, 2 * 60 * 60 * 1000).return('updated'); // 2 hours
                }
            });
    }

};


/*
** Methods
*/
schema.methods.doSync = function(freshness, done) {
    mongoose.model('Service').triggerSync(this._id, freshness).nodeify(done);
};

schema.methods.toggleSyncStatus = function (status, itemsFound, done) {
    if (!done) {
        done = itemsFound;
        itemsFound = 0;
    }

    this
        .set('sync.status', status)
        .set('sync.pending', false)
        .set('sync.processing', false)
        .set('sync.finishedAt', new Date())
        .set('sync.itemsFound', itemsFound || 0)
        .save(done);
};


export const collectionName = 'services';

export const model = mongoose.model('Service', schema, collectionName);
