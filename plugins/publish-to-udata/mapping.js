var moment = require('moment');
var Handlebars = require('handlebars');
var _ = require('lodash');
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
{{/if}}`
);

exports.map = function (sourceDataset) {
    sourceDataset.alternateResources = _.filter(sourceDataset.alternateResources || [], 'name');
    sourceDataset.inlineOrganizations = (sourceDataset.organizations || []).join(', ');

    sourceDataset.history = _(sourceDataset.metadata.history || [])
        .filter(function (ev) {
            return ev.date && moment(ev.date).isValid() && ev.type && _.includes(['creation', 'revision', 'publication'], ev.type);
        })
        .map(function (ev) {
            var labels = {
                creation: 'Création',
                revision: 'Mise à jour',
                publication: 'Publication'
            };
            return { date: moment(ev.date).format('L'), description: labels[ev.type] };
        })
        .value();

    var out = {
        title: sourceDataset.metadata.title,
        description: bodyTemplate(sourceDataset),
        extras: {
            // inspire_fileIdentifier: sourceDataset.metadata.fileIdentifier,
            geogw_recordId: sourceDataset.recordId
        },
        license: sourceDataset.metadata.license,
        supplier: {},
        resources: []
    };

    if (sourceDataset.metadata.keywords) {
        out.tags = sourceDataset.metadata.keywords.map(function (keyword) {
            return _.kebabCase(keyword).substring(0, 120);
        });
    }

    if (sourceDataset.dataset.distributions) {
        var processedFeatureTypes = [];

        sourceDataset.dataset.distributions.forEach(function (distribution) {
            if (!distribution.available) return;
            var rootUrl;

            if (distribution.type === 'wfs-featureType') {
                rootUrl = process.env.ROOT_URL + '/api/geogw/services/' + distribution.service + '/feature-types/' + distribution.typeName + '/download';
                if (_.includes(processedFeatureTypes, rootUrl)) return; // Cannot be added twice
                processedFeatureTypes.push(rootUrl);
                var simplifiedTypeName = _s.strRight(distribution.typeName, ':');

                out.resources.push({
                    url: rootUrl + '?format=GeoJSON&projection=WGS84',
                    title: simplifiedTypeName + ' (export GeoJSON)',
                    description: 'Conversion à la volée du jeu de données d\'origine ' + simplifiedTypeName + ' au format GeoJSON',
                    format: 'JSON',
                    type: 'api'
                });
                out.resources.push({
                    url: rootUrl + '?format=SHP&projection=WGS84',
                    title: simplifiedTypeName + ' (export SHP/WGS-84)',
                    description: 'Conversion à la volée du jeu de données d\'origine ' + simplifiedTypeName + ' au format Shapefile (WGS-84)',
                    format: 'SHP',
                    type: 'api'
                });
            } else if (distribution.type === 'file-package' && distribution.layer) {
                rootUrl = process.env.ROOT_URL + '/api/geogw/file-packages/' + distribution.hashedLocation + '/download';
                out.resources.push({
                    url: distribution.location,
                    title: 'Archive complète',
                    format: 'ZIP',
                    type: 'file'
                });
                out.resources.push({
                    url: rootUrl + '?format=GeoJSON&projection=WGS84',
                    title: `${distribution.layer} (export GeoJSON)`,
                    description: 'Conversion à la volée au format GeoJSON',
                    format: 'JSON',
                    type: 'api'
                });
                out.resources.push({
                    url: rootUrl + '?format=SHP&projection=WGS84',
                    title: `${distribution.layer} (export SHP/WGS-84)`,
                    description: 'Conversion à la volée au format Shapefile (WGS-84)',
                    format: 'SHP',
                    type: 'api'
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
