const { formatOneBase } = require('../helpers/formatters');


function resourceUrl(rootUrl, record) {
    if (!record.recordId) throw new Error('recordId not found in record object');
    return rootUrl + '/records/' + record.recordId.substring(0, 12);
}

const linkMapping = {
    '@relatedResources': { basePath: '/related-resources', sub: true },
    '@catalogs': { basePath: '/services', array: true, id: 'catalogs' }
};

const omitKeys = ['_id', '__v'];



function formatOne(resource) {
    return formatOneBase(resource, { resourceUrl, linkMapping, omitKeys });
}

function formatMany(resources) {
    return resources.map(resource => formatOne(resource));
}

module.exports = { resourceUrl, formatOne, formatMany };
