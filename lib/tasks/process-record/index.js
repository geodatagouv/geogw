const _ = require('lodash');
const Promise = require('bluebird');
const debug = require('debug')('geogw:process-record');
const mongoose = require('mongoose');
const OnlineResource = require('./onlineResources').OnlineResource;
const hashRecordId = require('../../helpers/hash').sha1;
const iso19139helpers = require('../../helpers/iso19139');
const convertDataset = require('../../helpers/convertDataset');

const RecordRevision = mongoose.model('RecordRevision');
const RelatedResource = mongoose.model('RelatedResource');


function markExistingRelatedResourcesAsChecking(originId, originHash) {
    return RelatedResource.markAsChecking({ originId, originHash });
}

function removeCheckingRelatedResources(originId, originHash) {
    return RelatedResource.remove({ originId, originHash, checking: true });
}

function getRecordRevision(recordId, recordHash) {
    return RecordRevision.findOne({ recordId, recordHash }).exec()
        .then(recordRevision => {
            if (!recordRevision) throw new Error('RecordRevision not found for: ' + { recordId, recordHash }.toJSON());
            return recordRevision;
        });
}

function processLinks(recordRevision) {
    const record = recordRevision.content;
    const recordType = recordRevision.recordType;

    // Conversion into unified model
    if (!['Record', 'MD_Metadata'].includes(recordType)) return;
    const convert = recordType === 'Record' ? convertDataset.fromDublinCore : convertDataset.fromIso;
    const unifiedRecord = convert(record);

    // Ignore services
    if (unifiedRecord.type === 'service') return;

    return Promise.each(unifiedRecord.links || [], resource => {
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

function processCoupledResources(recordRevision) {
    const record = recordRevision.content;

    const keywordsStr = iso19139helpers.getAllKeywords(record).join('').toLowerCase();
    const serviceType = _.get(record, 'identificationInfo.serviceType', '').toLowerCase();
    const title = _.get(record, 'identificationInfo.citation.title', '').toLowerCase();
    const onlineResources = iso19139helpers.getAllOnLineResources(record);
    const coupledResources = _.get(record, 'identificationInfo.coupledResource', []);

    const isWfsService = serviceType === 'download' ||
        serviceType.includes('wfs') ||
        title.includes('wfs') ||
        keywordsStr.includes('wfs') ||
        keywordsStr.includes('infofeatureaccessservice');

    if (record.hierarchyLevel !== 'service' || !coupledResources.length || !onlineResources.length || !isWfsService) return [];

    const candidateResources = _.chain(onlineResources)
        .map(resource => {
            try {
                resource = new OnlineResource(resource);
            } catch (err) {
                return;
            }
            const hasWfsInLocation = resource.sourceLocation && resource.sourceLocation.toLowerCase().includes('wfs');
            const hasWfsInProtocol = resource.sourceProtocol && resource.sourceProtocol.toLowerCase().includes('wfs');
            if (hasWfsInLocation || hasWfsInProtocol) {
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

function exec(job, done) {
    const { recordId, recordHash } = job.data;

    return getRecordRevision(recordId, recordHash)
        .then(recordRevision => {
            return markExistingRelatedResourcesAsChecking(recordId, recordHash)
                .then(() => processLinks(recordRevision))
                .then(() => processCoupledResources(recordRevision));
        })
        .then(() => removeCheckingRelatedResources(recordId, recordHash))
        .then(() => mongoose.model('ConsolidatedRecord').triggerUpdated(recordId, 'revision updated')) // Only useful for dataset records
        .nodeify(done);
}

module.exports = { exec };
