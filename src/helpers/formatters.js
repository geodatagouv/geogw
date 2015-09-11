/*eslint no-multi-spaces: 0, key-spacing: 0 */
import magicGet                             from 'lodash/object/get';
import magicSet                             from 'lodash/object/set';
import omit                                 from 'lodash/object/omit';
import forEachCollection                    from 'lodash/collection/forEach';

const rootUrl = process.env.ROOT_URL + '/api/geogw';

export function formatOneBase(resource, options) {
    // If resource is a mongoose document, we get the plain object one
    if (resource.toObject) resource = resource.toObject();

    let resourceUrl;
    if (options.resourceUrl) {
        resourceUrl = resource['@id'] = options.resourceUrl(rootUrl, resource);
    }

    forEachCollection(options.linkMapping, function (def, key) {
        if (magicGet(resource, key)) return;
        const baseUrl = (def.sub ? resourceUrl : rootUrl) + def.basePath;

        if (def.id && !def.array) {
            const foundId = magicGet(resource, def.id);
            if (foundId) {
                magicSet(resource, key, baseUrl + '/' + foundId);
            }
        } else if (def.id && def.array) {
            const foundIds = magicGet(resource, def.id);
            if (foundIds && foundIds.length > 0) {
                magicSet(resource, key, []);
                const array = magicGet(resource, key);
                foundIds.forEach(id => array.push(baseUrl + '/' + id));
            }
        } else {
            magicSet(resource, key, baseUrl);
        }
    });

    return options.omitKeys ? omit(resource, options.omitKeys) : resource;
}
