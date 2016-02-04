/* eslint comma-dangle: [2, "always-multiline"] */
const _ = require('lodash');
const iso19139helpers = require('./iso19139');
const parseUrl = require('url').parse;

function getFileNameFromHref(href) {
    const fullPath = parseUrl(href).pathname.split('/');
    return fullPath[fullPath.length - 1];
}

function getUniformArray(src) {
    return _.uniq(_.compact(_.flatten(src)));
}

function convertFromDublinCore(record) {
    const dataset = _.pick(record, 'title', 'description', 'type');

    // Keywords
    dataset.keywords = _.get(record, 'subject') || [];

    // Contributors
    const candidateContributors = [record.publisher, record.creator, record.contributor];
    dataset.contributors = getUniformArray(candidateContributors);

    // Links
    const candidateLinks = [record.relation, record.references];
    dataset.links = getUniformArray(candidateLinks).map(link => {
        const candidateName = getFileNameFromHref(link);
        const lcName = candidateName.toLowerCase();
        if (lcName.includes('licence') && lcName.includes('ouverte')) {
            dataset.license = 'fr-lo';
        }
        if (lcName.includes('odbl')) {
            dataset.license = 'odc-odbl';
        }
        return {
            name: candidateName,
            href: link,
        };
    });

    // Additional rules (custom)
    // ...placeholder...

    return dataset;
}

function convertFromIso(record) {
    const dataset = {};
    dataset.title = _.get(record, 'identificationInfo.citation.title');
    dataset.alternateTitle = _.get('identificationInfo.citation.alternateTitle');
    dataset.description = _.get(record, 'identificationInfo.abstract');
    dataset.type = _.get(record, 'hierarchyLevel');

    // Lineage
    dataset.lineage = _.get(record, 'dataQualityInfo.lineage.statement');

    // Keywords
    dataset.keywords = iso19139helpers.getAllKeywords(record);

    // Contributors
    dataset.contributors = iso19139helpers.getAllOrganizationNames(record);

    // Links
    dataset.links = iso19139helpers.getAllOnLineResources(record).map(resource => ({
        name: resource.name || getFileNameFromHref(resource.linkage),
        href: resource.linkage,
        protocol: resource.protocol,
    }));

    // Additional rules (custom)
    // ...placeholder...

    return dataset;
}

exports.fromIso = convertFromIso;
exports.fromDublinCore = convertFromDublinCore;
