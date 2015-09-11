import { formatOneBase } from '../helpers/formatters';


export function resourceUrl(rootUrl, remoteResource) {
    if (!remoteResource.hashedLocation) throw new Error('hashedLocation not found in remote resource object');
    return rootUrl + '/file-packages/' + remoteResource.hashedLocation;
}

export const linkMapping = {
    '@records': { basePath: '/records', sub: true }
};

export const omitKeys = ['_id', '__v'];



export function formatOne(resource) {
    return formatOneBase(resource, { resourceUrl, linkMapping, omitKeys });
}

export function formatMany(resources) {
    return resources.map(resource => formatOne(resource));
}
