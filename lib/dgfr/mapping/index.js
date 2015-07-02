var fs = require('fs');
var path = require('path');

var moment = require('moment');
var Handlebars = require('handlebars');
var _ = require('lodash');
var _s = require('underscore.string');
var debug = require('debug')('mapping');

moment.locale('fr');

var bodyTemplate = Handlebars.compile(fs.readFileSync(path.join(__dirname, 'template.hbs'), 'utf-8'));

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
            inspire_file_identifier: sourceDataset.identifier,
            geogw_hashed_id: sourceDataset.hashedId
        },
        license: 'fr-lo',
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
                rootUrl = process.env.GEOGW_URL + '/api/services/' + distribution.service + '/feature-types/' + distribution.typeName + '/download';
                if (_.includes(processedFeatureTypes, rootUrl)) return; // Cannot be added twice
                processedFeatureTypes.push(rootUrl);
                var simplifiedTypeName = _s.strRight(distribution.typeName, ':');

                out.resources.push({
                    url: rootUrl + '?format=GeoJSON&projection=WGS84',
                    title: simplifiedTypeName + ' (GeoJSON / WGS-84)',
                    description: 'Conversion à la volée du jeu de données d\'origine ' + simplifiedTypeName + ' au format GeoJSON (WGS-84)',
                    format: 'JSON',
                    type: 'api'
                });
                out.resources.push({
                    url: rootUrl + '?format=SHP&projection=Lambert93',
                    title: simplifiedTypeName + ' (Shapefile / Lambert-93)',
                    description: 'Conversion à la volée du jeu de données d\'origine ' + simplifiedTypeName + ' au format Shapefile (Lambert-93)',
                    format: 'SHP',
                    type: 'api'
                });
                out.resources.push({
                    url: rootUrl + '?format=CSV&projection=WGS84',
                    title: simplifiedTypeName + ' (CSV / pas de géométries)',
                    description: 'Conversion à la volée du jeu de données d\'origine ' + simplifiedTypeName + ' au format CSV',
                    format: 'CSV',
                    type: 'api'
                });
            } else if (distribution.type === 'file-package') {
                rootUrl = process.env.GEOGW_URL + '/api/file-packages/' + distribution.hashedLocation + '/download';
                out.resources.push({
                    url: distribution.location,
                    title: 'Télécharger le package complet source (données + documents)',
                    format: 'ZIP',
                    type: 'file'
                });
                out.resources.push({
                    url: rootUrl + '?format=GeoJSON&projection=WGS84',
                    title:  'Conversion à la volée (GeoJSON / WGS-84)',
                    description: 'Conversion à la volée au format GeoJSON (WGS-84)',
                    format: 'JSON',
                    type: 'api'
                });
                out.resources.push({
                    url: rootUrl + '?format=SHP&projection=Lambert93',
                    title:  'Conversion à la volée (Shapefile / Lambert-93)',
                    description: 'Conversion à la volée au format Shapefile (Lambert-93)',
                    format: 'SHP',
                    type: 'api'
                });
                out.resources.push({
                    url: rootUrl + '?format=CSV&projection=WGS84',
                    title:  'Conversion à la volée (CSV / pas de géométries)',
                    description: 'Conversion à la volée au format CSV',
                    format: 'CSV',
                    type: 'api'
                });
            }
        });
    }

    if (!out.resources.length) {
        debug('No publishable resources for %s (%s)', sourceDataset.metadata.title, sourceDataset.hashedId);
    }

    if (out.title.length === 0) throw new Error('title is a required field');
    if (out.description.length === 0) throw new Error('description is a required field');

    return out;
};
