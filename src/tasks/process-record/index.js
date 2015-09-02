import _ from 'lodash';
import magicGet from 'lodash/object/get';
import Promise from 'bluebird';
import debugFactory from 'debug';
import mongoose from 'mongoose';
import { OnlineResource } from './onlineResources';
import { hashRecordId } from '../../parsers/record/supportedTypes/MD_Metadata';

const debug = debugFactory('process-record');
const RecordRevision = mongoose.model('RecordRevision');
const RelatedResource = mongoose.model('RelatedResource');


export function markExistingRelatedResourcesAsChecking(originId) {
    return RelatedResource.markAsChecking({ originId });
}

export function removeCheckingRelatedResources(originId) {
    return RelatedResource.remove({ originId, checking: true });
}

export function getRecordRevision(recordId, recordHash) {
    return RecordRevision.findOne({ recordId, recordHash })
        .then(recordRevision => {
            if (!recordRevision) throw new Error('RecordRevision not found for: ' + { recordId, recordHash }.toJSON());
            return recordRevision;
        });
}

export function processOnlineResources(recordRevision) {
    const metadata = recordRevision.content;

    if (metadata.type === 'service' || !metadata.onlineResources) return [];

    return Promise.each(metadata.onlineResources, resource => {
        try {
            resource = new OnlineResource(resource);
        } catch (err) {
            return;
        }

        const relatedResource = {
            record: recordRevision.recordId,
            originId: recordRevision.recordId,
            originType: 'gmd:onLine',
            originHash: recordRevision.recordHash
        };

        if (resource.isWfsFeatureType()) {
            relatedResource.featureType = {
                candidateName: resource.getFeatureTypeName(),
                candidateLocation: resource.getNormalizedWfsServiceLocation()
            };
            return RelatedResource.upsert(relatedResource);
        }

        if (resource.isWmsLayer()) {
            // Do nothing
            return;
        }

        relatedResource.name = resource.name;
        relatedResource.remoteResource = {
            location: resource.getNormalizedString()
        };

        return RelatedResource.upsert(relatedResource);
    });
}

export function processCoupledResources(recordRevision) {
    const metadata = recordRevision.content;

    const keywords = magicGet(metadata, 'keywords', []).join('').toLowerCase();
    const serviceType = magicGet(metadata, 'serviceType', '').toLowerCase();
    const title = magicGet(metadata, 'title', '').toLowerCase();
    const onlineResources = magicGet(metadata, 'onlineResources', []);
    const coupledResources = magicGet(metadata, 'coupledResources', []);

    const isWfsService = serviceType === 'download' ||
        serviceType.includes('wfs') ||
        title.includes('wfs') ||
        keywords.includes('wfs') ||
        keywords.includes('infofeatureaccessservice');

    if (metadata.type !== 'service' || !coupledResources.length || !onlineResources.length || !isWfsService) return [];

    const candidateResources = _.chain(onlineResources)
        .map(resource => {
            try {
                resource = new OnlineResource(resource);
            } catch (err) {
                return;
            }
            if (resource.sourceLocation.toLowerCase().includes('wfs') || resource.sourceProtocol.toLowerCase().includes('wfs')) {
                return resource;
            }
        })
        .compact()
        .value();

    if (candidateResources.length === 0) {
        debug('No valid location found. WFS service metadata rejected.');
        return [];
    } else if (candidateResources.length > 1) {
        debug('Too many candidate locations found!!! WFS service metadata rejected.');
        return [];
    }

    const wfsServiceLocation = candidateResources[0].getNormalizedWfsServiceLocation();

    debug('process coupled resources');

    return Promise.each(coupledResources, coupledResource => {
        if (!coupledResource.scopedName || !coupledResource.identifier) return;

        const relatedResource = {
            record: hashRecordId(coupledResource.identifier),
            originId: recordRevision.recordId,
            originHash: recordRevision.recordHash,
            originType: 'srv:coupledResource',

            featureType: {
                candidateName: coupledResource.scopedName,
                candidateLocation: wfsServiceLocation
            }
        };

        return RelatedResource.upsert(relatedResource);
    });
}

export function exec(job, done) {
    const { recordId, recordHash } = job.data;

    return getRecordRevision(recordId, recordHash)
        .then(recordRevision => {
            return markExistingRelatedResourcesAsChecking(recordId)
                .then(() => processOnlineResources(recordRevision))
                .then(() => processCoupledResources(recordRevision));
        })
        .then(() => removeCheckingRelatedResources(recordId))
        .then(() => mongoose.model('ConsolidatedRecord').triggerUpdated(recordId))
        .nodeify(done);
}
