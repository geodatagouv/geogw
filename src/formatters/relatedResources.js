import { formatOneBase } from '../helpers/formatters';


export const linkMapping = {
    '@record': { basePath: '/records', id: 'record' },
    'remoteResource.@id': { basePath: '/file-packages', id: 'remoteResource.hashedLocation' }
};

export const omitKeys = ['_id', '__v'];

export function formatOne(resource) {
    return formatOneBase(resource, { linkMapping, omitKeys });
}

export function formatMany(resources) {
    return resources.map(resource => formatOne(resource));
}
