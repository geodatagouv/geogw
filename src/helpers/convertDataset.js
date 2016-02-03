/* eslint comma-dangle: [2, "always-multiline"] */
const _ = require('lodash');
const parseUrl = require('url').parse;

const getUniformArray = src => _.uniq(_.compact(_.flatten(src)));

function getFileNameFromHref(href) {
    const fullPath = parseUrl(href).pathname.split('/');
    return fullPath[fullPath.length - 1];
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
    const candidateKeywords = [_.get(record, 'identificationInfo.topicCategory')];
    const descriptiveKeywords = _.get(record, 'identificationInfo.descriptiveKeywords') || [];
    descriptiveKeywords.forEach(dk => candidateKeywords.push(dk.keyword));
    dataset.keywords = getUniformArray(candidateKeywords);

    // Contributors
    const candidateContributors = [_.get(record, 'contact.organisationName')];
    const pointsOfContact = _.get(record, 'identificationInfo.pointOfContact') || [];
    pointsOfContact.forEach(poc => candidateContributors.push(poc.organisationName));
    dataset.contributors = getUniformArray(candidateContributors);

    // Links
    const candidateLinks = [];
    const transferOptions = _.get(record, 'distributionInfo.transferOptions') || [];
    transferOptions.forEach(to => (to.onLine || []).forEach(resource => {
        candidateLinks.push({
            name: resource.name || getFileNameFromHref(resource.linkage),
            href: resource.linkage,
            protocol: resource.protocol
        });
    }));
    dataset.links = getUniformArray(candidateLinks);

    // Additional rules (custom)
    // ...placeholder...

    return dataset;
}

exports.fromIso = convertFromIso;
exports.fromDublinCore = convertFromDublinCore;
