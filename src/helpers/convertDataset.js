/* eslint comma-dangle: [2, "always-multiline"] */
const _ = require('lodash');
const _s = require('underscore.string');
const iso19139helpers = require('./iso19139');
const parseUrl = require('url').parse;

function getFileNameFromHref(href) {
    const fullPath = parseUrl(href).pathname.split('/');
    return fullPath[fullPath.length - 1];
}

function getUniformArray(src) {
    return _.uniq(_.compact(_.flatten(src)));
}

function getLicenseFromLinks(links) {
    let license;
    links.forEach(link => {
        const lcName = link.name.toLowerCase();
        if (lcName.includes('licence') && lcName.includes('ouverte')) {
            license = 'fr-lo'; return;
        }
        if (lcName.includes('odbl')) {
            license = 'odc-odbl'; return;
        }
    });
    return license;
}

const openDataKeywords = [
    'donnee-ouverte',
    'donnees-ouvertes',
    'donnee-ouvertes',
    'donnees-ouverte',
    'opendata',
    'open-data',
];

function getLicenseFromKeywords(keywords) {
    keywords = keywords.map(_.kebabCase);
    let openness = false;

    // Detect PRODIGE usual keywords
    openness = openness || (_s.include(keywords, 'grand-public') &&
        (_s.include(keywords, 'non-restreint') || _s.include(keywords, 'ouvert')));

    // Detect official keyword and variations (CNIG)
    openness = openness || _.find(keywords, k => openDataKeywords.includes(k));

    return openness ? 'fr-lo' : null;
}

const catalogsKnownAsOpen = [
    '54f5a39a62781800bf6db9e6',
    '53a01c3c23a9836106440e0f',
    '560015bf7cb6bdf9d0422ae7',
];

function getLicenseFromCatalogs(catalogs) {
    const openness = _.find(catalogs, catalog => catalogsKnownAsOpen.includes(catalog._id.toString()));
    return openness ? 'fr-lo' : null;
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
    dataset.links = getUniformArray(candidateLinks).map(link => ({
        name: getFileNameFromHref(link),
        href: link,
    }));

    // License
    dataset.license = getLicenseFromLinks(dataset.links) ||
        getLicenseFromCatalogs([]);

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

    // License
    dataset.license = getLicenseFromLinks(dataset.links) || getLicenseFromKeywords(dataset.keywords) ||
        getLicenseFromCatalogs([]);

    // Additional rules (custom)
    // ...placeholder...

    return dataset;
}

exports.fromIso = convertFromIso;
exports.fromDublinCore = convertFromDublinCore;
exports.getLicenseFromLinks = getLicenseFromLinks;
