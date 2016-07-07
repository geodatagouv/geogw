const { formatOneBase } = require('../helpers/formatters');


function resourceUrl(rootUrl, remoteResource) {
    if (!remoteResource.hashedLocation) throw new Error('hashedLocation not found in remote resource object');
    return rootUrl + '/file-packages/' + remoteResource.hashedLocation;
}

const linkMapping = {
    '@records': { basePath: '/records', sub: true }
};

const omitKeys = ['_id', '__v'];



function formatOne(resource) {
    return formatOneBase(resource, { resourceUrl, linkMapping, omitKeys });
}

function formatMany(resources) {
    return resources.map(resource => formatOne(resource));
}

module.exports = { formatOne, formatMany, resourceUrl };
