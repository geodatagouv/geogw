const mongoose = require('mongoose');
const pick = require('lodash').pick;
const _ = require('lodash');
const distributions = require('./distributions');
const computeFacets = require('../../helpers/facets').compute;
const Promise = require('bluebird');
const convertDataset = require('../../helpers/convertDataset');

const RecordRevision = mongoose.model('RecordRevision');
const CatalogRecord = mongoose.model('CatalogRecord');
const ConsolidatedRecord = mongoose.model('ConsolidatedRecord');
const RelatedResource = mongoose.model('RelatedResource');
const OrganizationSpelling = mongoose.model('OrganizationSpelling');
const Dataset = mongoose.model('Dataset');

function getCatalogRecords(recordId) {
    return CatalogRecord
        .find({ recordId })
        .sort('-createdAt -revisionDate')
        .populate('catalog', 'name')
        .lean()
        .exec()
        .then(catalogRecords => {
            if (catalogRecords.length === 0) throw new Error('No catalog record found for recordId: ' + recordId);
            return catalogRecords;
        });
}

function getBestRecordRevision(catalogRecords) {
    return RecordRevision.findOne(pick(catalogRecords[0], 'recordId', 'recordHash')).exec()
        .then(recordRevision => {
            if (!recordRevision) throw new Error('Record revision not found for: ' + recordRevision.toJSON());
            return recordRevision;
        });
}

function fetchRelatedResources(recordId) {
    return RelatedResource.find({ record: recordId }).exec();
}

function getConsolidatedRecord(recordId) {
    return ConsolidatedRecord.findOne({ recordId }).exec()
        .then(record => {
            if (!record) throw new Error('ConsolidatedRecord not found for ' + recordId);
            return record;
        });
}

function fetchPublications(datasetId) {
    return Dataset.findById(datasetId).exec()
        .then(publicationInfo => {
            if (!publicationInfo || !publicationInfo.publication.status) return [];
            return [{
                website: 'data.gouv.fr',
                id: publicationInfo.publication._id,
                status: publicationInfo.publication.status,
                owner: publicationInfo.publication.organization.toString()
            }];
        });
}

function createDatasetFromRecord(recordRevision) {
    if (recordRevision.recordType === 'Record') {
        return convertDataset.fromDublinCore(recordRevision.content);
    }
    if (recordRevision.recordType === 'MD_Metadata') {
        return convertDataset.fromIso(recordRevision.content);
    }
    throw new Error('Not supported record type: ' + recordRevision.recordType);
}

function applyRecordRevisionChanges(record, recordRevision) {
    // if (record.recordHash && record.recordHash === recordRevision.recordHash) return Promise.resolve(record);
    record
        .set('recordHash', recordRevision.recordHash)
        .set('revisionDate', recordRevision.revisionDate)
        .set('metadata', createDatasetFromRecord(recordRevision));

    return Promise.resolve(record);
}

function applyOrganizationsFilter(record) {

    const spellings = record.metadata.contributors;

    return Promise.map(spellings, spelling => {
        return OrganizationSpelling
            .findByIdAndUpdate(spelling, {}, { upsert: true, new: true })
            .populate('organization')
            .lean()
            .exec()
            .then(organizationSpelling => {
                if (organizationSpelling.rejected) return;
                if (organizationSpelling.organization && organizationSpelling.organization.name)
                    return organizationSpelling.organization.name;
                return spelling;
            });
    })
    .then(organizationNames => {
        organizationNames = _.chain(organizationNames).compact().uniq().valueOf();
        return record.set('organizations', organizationNames);
    });
}

function applyPublications(record, publications) {
    record.set('publications', publications);
}

function applyResources(record, relatedResources) {
    const dist = [];
    const alt = [];

    relatedResources.forEach(function (resource) {
        var distribution;
        if (resource.type === 'feature-type') {
            distribution = distributions.buildFeatureType(resource);
            if (distribution) dist.push(distribution);
        } else if (resource.type === 'remote-resource' && ['file-distribution', 'unknown-archive'].includes(resource.remoteResource.type)) {
            const layers = distributions.buildLayers(resource);
            if (layers) {
                Array.prototype.push.apply(dist, layers);
            } else {
                dist.push(distributions.buildOriginalDistribution(resource));
            }
        } else {
            alt.push({
                name: resource.name,
                location: resource.remoteResource.location,
                available: resource.remoteResource.available
            });
        }
    });

    return Promise.resolve(record
        .set('dataset.distributions', _.uniq(dist, 'uniqueId'))
        .set('alternateResources', _.uniq(alt, 'location')));
}

function exec(job, done) {
    const recordId = job.data.recordId;
    const now = new Date();

    return ConsolidatedRecord.toggleConsolidating(recordId, true)
        .then(marked => {
            if (!marked) throw new Error('Already consolidating...');
            return getCatalogRecords(recordId)
                .then(catalogRecords => {
                    return Promise.join(
                        getConsolidatedRecord(recordId),
                        fetchRelatedResources(recordId),
                        getBestRecordRevision(catalogRecords),
                        fetchPublications(recordId),

                        (record, relatedResources, recordRevision, publications) => {
                            const process = Promise.try(() => applyRecordRevisionChanges(record, recordRevision))
                                .then(() => applyOrganizationsFilter(record))
                                .then(() => applyResources(record, relatedResources))
                                .then(() => applyPublications(record, publications))
                                .then(() => {
                                    return record
                                        .set('catalogs', catalogRecords.map(catalogRecord => catalogRecord.catalog._id))
                                        .set('dataset.updatedAt', now)
                                        .set('facets', computeFacets(record, catalogRecords.map(catalogRecord => catalogRecord.catalog)))
                                        .save();
                                });
                            process.finally(() => ConsolidatedRecord.toggleConsolidating(recordId, false));
                            return process;
                        }
                    );
                });
        })
        .nodeify(done);
}

exports.exec = exec;
exports.applyResources = applyResources;
exports.applyOrganizationsFilter = applyOrganizationsFilter;
exports.applyRecordRevisionChanges = applyRecordRevisionChanges;
exports.getConsolidatedRecord = getConsolidatedRecord;
exports.fetchRelatedResources = fetchRelatedResources;
exports.getCatalogRecords = getCatalogRecords;
exports.getBestRecordRevision = getBestRecordRevision;
