'use strict';

/* eslint comma-dangle: [2, "always-multiline"] */
const { uniq, compact, flatten, kebabCase, pick, get } = require('lodash');
const _s = require('underscore.string');
const {
  getAllOnLineResources,
  getAllKeywords,
  getAllContacts,
  getConsolidatedExtent,
  getUpdateFrequency,
  getDates,
  getSpatialResolution,
  getStatus,
  getTopicCategory,
  getInspireThemeFromKeywords,
} = require('./iso19139');
const { getCoupledResources } = require('./iso19139/services');
const normalizeProducerNames = require('../../../france/normalizeProducerNames');
const parseUrl = require('url').parse;
const checkUrl = require('../checkUrl');
const { sha1 } = require('../hash');

function getFileNameFromHref(href) {
    if (!href) return null;
    const pathname = parseUrl(href).pathname;
    if (!pathname) return null;
    const fullPath = parseUrl(href).pathname.split('/');
    return fullPath[fullPath.length - 1];
}

function getUniformArray(src) {
    return uniq(compact(flatten(src)));
}

function getLicenseFromLinks(links) {
    let license;
    links.forEach(link => {
        const lcName = (link.name || '').toLowerCase();
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
    keywords = keywords.map(kebabCase);
    let openness = false;

    // Detect PRODIGE usual keywords
    openness = openness || (_s.include(keywords, 'grand-public') &&
        (_s.include(keywords, 'non-restreint') || _s.include(keywords, 'ouvert')));

    // Detect official keyword and variations (CNIG)
    openness = openness || keywords.find(k => openDataKeywords.includes(k));

    return openness ? 'fr-lo' : null;
}

const catalogsKnownAsOpen = [
    '54f5a39a62781800bf6db9e6',
    '53a01c3c23a9836106440e0f',
    '560015bf7cb6bdf9d0422ae7',
];

function getLicenseFromCatalogs(catalogs) {
    const openness = catalogs.find(catalog => catalogsKnownAsOpen.includes(catalog._id.toString()));
    return openness ? 'fr-lo' : null;
}

function cleanKeywords(keywords = []) {
  return keywords.filter(k => k.length < 768);
}

function normalizeContacts(contacts) {
  return compact(contacts.map(contact => {
    const normalization = {};
    try {
      normalization.organizationName = normalizeProducerNames(contact.organizationName);
    } catch (err) {
      return;
    }
    return Object.assign({}, contact, normalization);
  }));
}

function convertFromDublinCore(record) {
    const dataset = pick(record, 'title', 'description', 'type');
    dataset.id = record.identifier;
    dataset.metadataType = 'Dublin Core';

    // Keywords
    dataset.keywords = cleanKeywords(get(record, 'subject') || []);

    // Contacts
    const candidateContributors = [record.publisher, record.creator, record.contributor];
    dataset.contacts = normalizeContacts(getUniformArray(candidateContributors).map(contributor => ({
      organizationName: contributor,
      relatedTo: 'data',
      role: 'notDefined',
    })));

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

function prepareThumbnails(graphicOverviews = []) {
  return graphicOverviews
    .map(go => ({
      originalUrl: go.fileName && go.fileName.trim(),
      description: go.fileDescription && go.fileDescription.trim(),
    }))
    .filter(thumbnail => thumbnail.originalUrl && checkUrl(thumbnail.originalUrl))
    .map(thumbnail => {
      thumbnail.originalUrlHash = sha1(thumbnail.originalUrl).substr(0, 7);
      return thumbnail;
    });
}

function convertFromIso(record) {
    const dataset = { metadataType: 'ISO 19139' };
    dataset.id = record.fileIdentifier;
    dataset.title = get(record, 'identificationInfo.citation.title');
    dataset.alternateTitle = get('identificationInfo.citation.alternateTitle');
    dataset.description = get(record, 'identificationInfo.abstract');
    dataset.type = get(record, 'hierarchyLevel');
    dataset.spatialRepresentationType = get(record, 'identificationInfo.spatialRepresentationType');

    // Lineage
    dataset.lineage = get(record, 'dataQualityInfo.lineage.statement');

    // Purpose
    dataset.purpose = get(record, 'identificationInfo.purpose');

    // Credit
    dataset.credit = get(record, 'identificationInfo.credit');

    // Status
    dataset.status = getStatus(record);

    const keywords = getAllKeywords(record);

    // Keywords
    dataset.keywords = cleanKeywords(keywords);

    // INSPIRE theme
    dataset.inspireTheme = getInspireThemeFromKeywords(keywords);

    // Topic category
    dataset.topicCategory = getTopicCategory(record);

    // Thumbnails
    dataset.thumbnails = prepareThumbnails(get(record, 'identificationInfo.graphicOverview'));

    // Contacts
    dataset.contacts = normalizeContacts(getAllContacts(record));

    // Links
    dataset.links = getAllOnLineResources(record).map(resource => ({
        name: resource.name || getFileNameFromHref(resource.linkage),
        href: resource.linkage,
        protocol: resource.protocol,
    }));

    // License
    dataset.license = getLicenseFromLinks(dataset.links) || getLicenseFromKeywords(dataset.keywords) ||
        getLicenseFromCatalogs([]);

    // Spatial extent
    dataset.spatialExtent = getConsolidatedExtent(record);

    // Update frequency
    dataset.updateFrequency = getUpdateFrequency(record);

    // Equivalent scale denominator
    dataset.equivalentScaleDenominator = get(record, 'identificationInfo.spatialResolution.equivalentScale.denominator');

    dataset.spatialResolution = getSpatialResolution(record);

    if (dataset.type === 'service') {
      dataset.coupledResources = getCoupledResources(record);
    }

    Object.assign(dataset, getDates(record));
    // Additional rules (custom)
    // ...placeholder...

    return dataset;
}

exports.fromIso = convertFromIso;
exports.fromDublinCore = convertFromDublinCore;
exports.getLicenseFromLinks = getLicenseFromLinks;
