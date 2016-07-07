const { formatOneBase } = require('../helpers/formatters');

const linkMapping = {
    '@record': { basePath: '/records', id: 'record' },
    'remoteResource.@id': { basePath: '/file-packages', id: 'remoteResource.hashedLocation' }
};

const omitKeys = ['_id', '__v'];

function formatOne(resource) {
    return formatOneBase(resource, { linkMapping, omitKeys });
}

function formatMany(resources) {
    return resources.map(resource => formatOne(resource));
}

module.exports = { formatOne, formatMany };
