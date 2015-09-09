/*eslint no-multi-spaces: 0, key-spacing: 0 */
import forEachCollection    from 'lodash/collection/forEach';
import magicGet             from 'lodash/object/get';
import omit                 from 'lodash/object/omit';

const rootUrl = process.env.ROOT_URL + '/api/geogw';

export function baseUrl(record) {
    if (!record.recordId) throw new Error('recordId not found in record object');
    return rootUrl + '/records/' + record.recordId.substring(0, 12);
}

const linkMapping = {
    '@relatedResources': { basePath: '/related-resources', sub: true },
    '@catalogs': { basePath: '/services', array: true, id: 'catalogs' }
};

const omittingKeys = ['_id', '__v'];

export function formatOne(record) {
    // If record is a mongoose document, we get the plain object one
    if (record.toObject) record = record.toObject();

    const recordUrl = record['@id'] = baseUrl(record);

    forEachCollection(linkMapping, function (def, key) {
        if (record[key]) return;
        const baseUrl = (def.sub ? recordUrl : rootUrl) + def.basePath;

        if (def.id && !def.array) {
            const foundId = magicGet(record, def.id);
            if (foundId) {
                record[key] = baseUrl + '/' + foundId;
            }
        } else if (def.id && def.array) {
            const foundIds = magicGet(record, def.id);
            if (foundIds && foundIds.length > 0) {
                record[key] = [];
                foundIds.forEach(id => record[key].push(baseUrl + '/' + id));
            }
        } else {
            record[key] = baseUrl;
        }
    });

    return omit(record, omittingKeys);
}

export function formatMany(records) {
    return records.map(record => formatOne(record));
}
