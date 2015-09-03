/*eslint no-multi-spaces: 0, key-spacing: 0 */
import mongoose                     from 'mongoose';
import pick                         from 'lodash/object/pick';
import _                            from 'lodash';
import distributions                from './distributions';
import organizations                from './organizations';
import { compute as computeFacets } from '../../helpers/facets';
import Promise                      from 'bluebird';

const RecordRevision        = mongoose.model('RecordRevision');
const CatalogRecord         = mongoose.model('CatalogRecord');
const ConsolidatedRecord    = mongoose.model('ConsolidatedRecord');
const RelatedResource       = mongoose.model('RelatedResource');


export function getMoreRecentCatalogRecord(recordId) {
    return CatalogRecord.findOne({ recordId }).sort({ revisionDate: -1 }).exec()
        .then(catalogRecord => {
            if (!catalogRecord) throw new Error('No catalog record found for recordId: ' + recordId);
            return catalogRecord;
        });
}

export function getMoreRecentRecordRevision(recordId) {
    return getMoreRecentCatalogRecord(recordId)
        .then(catalogRecord => RecordRevision.findOne(pick(catalogRecord, 'recordId', 'recordHash')).exec())
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
    if (record.recordHash && record.recordHash === recordRevision.recordHash) return record;
    record
        .set('recordHash', recordRevision.recordHash)
        .set('metadata', recordRevision.content)
        .set('revisionDate', recordRevision.revisionDate);

    // Process representationType
    if (record.metadata.representationType === 'raster') {
        // TODO: Warn catalog owner
        record.metadata.representationType = 'grid';
    }

    return record;
}

export function applyOrganizationsFilter(record) {

    function normalizeOrganization(contact) {
        const originalName = contact.organizationName;
        if (!originalName) return;
        if (!organizations[originalName]) return originalName;
        if (organizations[originalName].reject) return; // TODO: Warn catalog owner
        if (organizations[originalName].rename) return organizations[originalName].rename;
    }

    const normalizedOrganizations = _.chain([record.metadata.contacts, record.metadata._contacts])
        .flatten()
        .compact()
        .map(normalizeOrganization)
        .compact()
        .uniq()
        .valueOf();

    return record.set('organizations', normalizedOrganizations);
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

    return record
        .set('dataset.distributions', dist)
        .set('alternateResources', alt);
}

export function exec(job, done) {
    const recordId = job.data.recordId;
    const now = new Date();

    return ConsolidatedRecord.toggleConsolidating(recordId, true)
        .then(marked => {
            if (!marked) return true;
            return Promise.props({
                record: getConsolidatedRecord(recordId),
                relatedResources: fetchRelatedResources(recordId),
                recordRevision: getMoreRecentRecordRevision(recordId)
            }).then(r => {
                applyRecordRevisionChanges(r.record, r.recordRevision);
                applyOrganizationsFilter(r.record); // Systematically for now
                applyResources(r.record, r.relatedResources);
                return r.record
                    .set('dataset.updatedAt', now)
                    .set('facets', computeFacets(r.record))
                    .save()
                    .then(() => ConsolidatedRecord.toggleConsolidating(recordId, false));
            });
        })
        .nodeify(done);
}
