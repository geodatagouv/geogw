const _ = require('lodash');


function getUniformArray(src) {
    return _.uniq(_.compact(_.flatten(src)));
}

function getAllKeywords(metadata) {
    const candidateKeywords = [_.get(metadata, 'identificationInfo.topicCategory')];
    const descriptiveKeywords = _.get(metadata, 'identificationInfo.descriptiveKeywords') || [];
    descriptiveKeywords.forEach(dk => candidateKeywords.push(dk.keyword));
    return getUniformArray(candidateKeywords);
}

function getAllOnLineResources(metadata) {
    const candidateLinks = [];
    const transferOptions = _.get(metadata, 'distributionInfo.transferOptions') || [];
    transferOptions.forEach(to => (to.onLine || []).forEach(resource => candidateLinks.push(resource)));
    return getUniformArray(candidateLinks);
}

function getAllOrganizationNames(metadata) {
    const candidateContributors = [_.get(metadata, 'contact.organisationName')];
    const pointsOfContact = _.get(metadata, 'identificationInfo.pointOfContact') || [];
    pointsOfContact.forEach(poc => candidateContributors.push(poc.organisationName));
    return getUniformArray(candidateContributors);
}


exports.getAllKeywords = getAllKeywords;
exports.getAllOnLineResources = getAllOnLineResources;
exports.getAllOrganizationNames = getAllOrganizationNames;
