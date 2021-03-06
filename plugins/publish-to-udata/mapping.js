var moment = require('moment');
var Handlebars = require('handlebars');
const { get, filter, kebabCase } = require('lodash');
var _s = require('underscore.string');
var debug = require('debug')('mapping');

moment.locale('fr');

var bodyTemplate = Handlebars.compile(
`{{metadata.description}}

{{#if metadata.lineage}}
__Origine__

{{metadata.lineage}}
{{/if}}

{{#if history}}
__Historique__

{{#each history}}
 * {{date}} : {{description}}
{{/each}}
{{/if}}

{{#if inlineOrganizations}}
__Organisations partenaires__

{{inlineOrganizations}}
{{/if}}

{{#if alternateResources}}
__Liens annexes__

{{#each alternateResources}}
 * [{{name}}]({{location}})
{{/each}}

{{/if}}
➞ [Consulter cette fiche sur geo.data.gouv.fr](https://geo.data.gouv.fr/datasets/{{recordId}})`
);

exports.map = function (sourceDataset) {
    sourceDataset.alternateResources = filter(sourceDataset.alternateResources || [], 'name');
    sourceDataset.inlineOrganizations = (sourceDataset.organizations || []).join(', ');

    sourceDataset.history = (sourceDataset.metadata.history || [])
        .filter(function (ev) {
            return ev.date && moment(ev.date).isValid() && ev.type && ['creation', 'revision', 'publication'].includes(ev.type);
        })
        .map(function (ev) {
            var labels = {
                creation: 'Création',
                revision: 'Mise à jour',
                publication: 'Publication'
            };
            return { date: moment(ev.date).format('L'), description: labels[ev.type] };
        });

    var out = {
        title: sourceDataset.metadata.title,
        description: bodyTemplate(sourceDataset),
        extras: {
            'inspire:identifier': sourceDataset.metadata.id,
            'inspire:resource_identifier': get(sourceDataset, 'metadata.resourceId'),
            'geop:dataset_id': sourceDataset.recordId
        },
        license: sourceDataset.metadata.license,
        supplier: {},
        resources: []
    };

    if (sourceDataset.metadata.coveredTerritories) {
        out.spatial = { zones: sourceDataset.metadata.coveredTerritories };
    }

    if (sourceDataset.metadata.keywords) {
        out.tags = sourceDataset.metadata.keywords
          .map(tag => kebabCase(tag))
          .filter(tag => tag.length <= 32 && tag.length >= 3);
        out.tags.push('passerelle-inspire');
    }

    if (sourceDataset.dataset.distributions) {
        var processedFeatureTypes = [];

        sourceDataset.dataset.distributions.forEach(function (distribution) {
            if (!distribution.available) return;
            var rootUrl;

            if (distribution.type === 'wfs-featureType') {
                rootUrl = process.env.ROOT_URL + '/api/geogw/services/' + distribution.service + '/feature-types/' + distribution.typeName + '/download';
                if (processedFeatureTypes.includes(rootUrl)) return; // Cannot be added twice
                processedFeatureTypes.push(rootUrl);
                var simplifiedTypeName = _s.strRight(distribution.typeName, ':');

                out.resources.push({
                    url: rootUrl + '?format=GeoJSON&projection=WGS84',
                    title: simplifiedTypeName + ' (export GeoJSON)',
                    description: 'Conversion à la volée du jeu de données d\'origine ' + simplifiedTypeName + ' au format GeoJSON',
                    format: 'JSON',
                    filetype: 'remote',
                    extras: {
                        'geop:resource_id': `wfs:${distribution.service}/${distribution.typeName}`
                    }
                });
                out.resources.push({
                    url: rootUrl + '?format=SHP&projection=WGS84',
                    title: simplifiedTypeName + ' (export SHP/WGS-84)',
                    description: 'Conversion à la volée du jeu de données d\'origine ' + simplifiedTypeName + ' au format Shapefile (WGS-84)',
                    format: 'SHP',
                    filetype: 'remote'
                });
            } else if (distribution.type === 'file-package' && distribution.layer) {
                rootUrl = process.env.ROOT_URL + '/api/geogw/file-packages/' + distribution.hashedLocation + '/download';
                out.resources.push({
                    url: distribution.location,
                    title: 'Archive complète',
                    format: 'ZIP',
                    filetype: 'remote'
                });
                out.resources.push({
                    url: rootUrl + '?format=GeoJSON&projection=WGS84',
                    title: `${distribution.layer} (export GeoJSON)`,
                    description: 'Conversion à la volée au format GeoJSON',
                    format: 'JSON',
                    filetype: 'remote',
                    extras: {
                        'geop:resource_id': `file-package:${distribution.hashedLocation}/${distribution.layer}`
                    }
                });
                out.resources.push({
                    url: rootUrl + '?format=SHP&projection=WGS84',
                    title: `${distribution.layer} (export SHP/WGS-84)`,
                    description: 'Conversion à la volée au format Shapefile (WGS-84)',
                    format: 'SHP',
                    filetype: 'remote'
                });
            } else if (distribution.type === 'file-package' && distribution.originalDistribution) {
                out.resources.push({
                    url: distribution.location,
                    title: distribution.name,
                    format: 'ZIP',
                    filetype: 'remote'
                });
            }
        });
    }

    if (!out.resources.length) {
        debug('No publishable resources for %s (%s)', sourceDataset.metadata.title, sourceDataset.recordId);
    }

    if (out.title.length === 0) throw new Error('title is a required field');
    if (out.description.length === 0) throw new Error('description is a required field');

    return out;
};
