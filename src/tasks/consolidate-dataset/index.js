/*eslint no-multi-spaces: 0, key-spacing: 0 */
import mongoose                     from 'mongoose';
import pick                         from 'lodash/object/pick';
import _                            from 'lodash';
import distributions                from './distributions';
import { compute as computeFacets } from '../../helpers/facets';
import Promise                      from 'bluebird';

const RecordRevision        = mongoose.model('RecordRevision');
const CatalogRecord         = mongoose.model('CatalogRecord');
const ConsolidatedRecord    = mongoose.model('ConsolidatedRecord');
const RelatedResource       = mongoose.model('RelatedResource');
const OrganizationSpelling  = mongoose.model('OrganizationSpelling');


export function getCatalogRecords(recordId) {
    return CatalogRecord
        .find({ recordId })
        .sort('-revisionDate')
        .populate('catalog', 'name')
        .lean()
        .exec()
        .then(catalogRecords => {
            if (catalogRecords.length === 0) throw new Error('No catalog record found for recordId: ' + recordId);
            return catalogRecords;
        });
}

export function getBestRecordRevision(catalogRecordsPromise) {
    return catalogRecordsPromise
        .then(catalogRecords => RecordRevision.findOne(pick(catalogRecords[0], 'recordId', 'recordHash')).exec())
        .then(recordRevision => {
            if (!recordRevision) throw new Error('Record revision not found for: ' + recordRevision.toJSON());
            return recordRevision;
        });
}

export function fetchRelatedResources(recordId) {
    return RelatedResource.find({ record: recordId }).exec();
}

export function getConsolidatedRecord(recordId) {
    return ConsolidatedRecord.findOne({ recordId }).exec()
        .then(record => {
            if (!record) throw new Error('ConsolidatedRecord not found for ' + recordId);
            return record;
        });
}

export function applyRecordRevisionChanges(record, recordRevision) {
    if (record.recordHash && record.recordHash === recordRevision.recordHash) return Promise.resolve(record);
    record
        .set('recordHash', recordRevision.recordHash)
        .set('metadata', recordRevision.content)
        .set('revisionDate', recordRevision.revisionDate);

    // Process representationType
    if (record.metadata.representationType === 'raster') {
        // TODO: Warn catalog owner
        record.metadata.representationType = 'grid';
    }

    return Promise.resolve(record);
}

export function applyOrganizationsFilter(record) {

    let organizationSpellingsSource = _.chain([record.metadata.contacts, record.metadata._contacts])
        .flatten()
        .pluck('organizationName')
        .compact()
        .uniq()
        .valueOf();

    return OrganizationSpelling.find().where('_id').in(organizationSpellingsSource).populate('organization').lean().exec()
        .then(organizationSpellingsFound => {
            organizationSpellingsFound = _.indexBy(organizationSpellingsFound, '_id');
            return _.chain(organizationSpellingsSource)
                .map(organizationSpelling => {
                    if (organizationSpelling in organizationSpellingsFound) {
                        let foundOne = organizationSpellingsFound[organizationSpelling];
                        if (foundOne.rejected) return;
                        if (foundOne.organization && foundOne.organization.name) return foundOne.organization.name;
                    }
                    return organizationSpelling;
                })
                .compact()
                .uniq()
                .valueOf();
        })
        .then(normalizedOrganizations => record.set('organizations', normalizedOrganizations));
}

export function applyResources(record, relatedResources) {
    const dist = [];
    const alt = [];

    relatedResources.forEach(function (resource) {
        var distribution;
        if (resource.type === 'feature-type') {
            distribution = distributions.buildFeatureType(resource);
            if (distribution) dist.push(distribution);
        } else if (resource.type === 'remote-resource' && resource.remoteResource.type === 'file-distribution') {
            Array.prototype.push.apply(dist, distributions.buildLayers(resource));
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

export function exec(job, done) {
    const recordId = job.data.recordId;
    const now = new Date();

    return ConsolidatedRecord.toggleConsolidating(recordId, true)
        .then(marked => {
            const catalogRecordsPromise = getCatalogRecords(recordId);
            if (!marked) return true;
            return Promise.props({
                catalogRecords: catalogRecordsPromise,
                record: getConsolidatedRecord(recordId),
                relatedResources: fetchRelatedResources(recordId),
                recordRevision: getBestRecordRevision(catalogRecordsPromise)
            }).then(r => {
                return applyRecordRevisionChanges(r.record, r.recordRevision)
                    .then(() => applyOrganizationsFilter(r.record))
                    .then(() => applyResources(r.record, r.relatedResources))
                    .then(() => {
                        return r.record
                            .set('catalogs', r.catalogRecords.map(catalogRecord => catalogRecord.catalog._id))
                            .set('dataset.updatedAt', now)
                            .set('facets', computeFacets(r.record, r.catalogRecords.map(catalogRecord => catalogRecord.catalog)))
                            .save();
                    })
                    .then(() => ConsolidatedRecord.toggleConsolidating(recordId, false));

            });
        })
        .nodeify(done);
}
