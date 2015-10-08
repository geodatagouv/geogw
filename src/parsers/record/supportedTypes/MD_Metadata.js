var _ = require('lodash');
var stringify = require('json-stable-stringify');
var debug = require('debug')('iso19139');

var sha1 = require('../../../helpers/hash').sha1;

function hashRecordId(recordId) {
    return sha1(recordId);
}

function hashRecord(record) {
    return sha1(stringify(_.omit(record, '_updated')));
}

var ns = {
    gmd: 'http://www.isotc211.org/2005/gmd',
    srv: 'http://www.isotc211.org/2005/srv',
    gco: 'http://www.isotc211.org/2005/gco',
    xlink: 'http://www.w3.org/1999/xlink'
};

var definitions = {

    Main: {
        './/gmd:identificationInfo//gmd:citation//gmd:title': 'title',
        './/gmd:identificationInfo//gmd:citation//gmd:alternateTitle': 'alternateTitle',
        './/gmd:identificationInfo//gmd:citation//gmd:date': { dest: 'history', type: 'Date', multi: true },

        './/gmd:identificationInfo//gmd:abstract': 'abstract',
        './/gmd:fileIdentifier': 'fileIdentifier',
        './/gmd:identificationInfo//gmd:identifier': 'identifier',
        './/gmd:identificationInfo//gmd:language': 'language',
        './/gmd:dataQualityInfo//gmd:lineage//gmd:statement': 'lineage',
        './/gmd:hierarchyLevel/gmd:MD_ScopeCode/@codeListValue': 'type',
        './/gmd:identificationInfo//gmd:MD_SpatialRepresentationTypeCode/@codeListValue': 'representationType',
        './/gmd:dateStamp': '_updated',
        './/gmd:identificationInfo//gmd:extent': { dest: 'extents', type: 'Extent', multi: true },
        './/gmd:identificationInfo//gmd:maintenanceAndUpdateFrequency//gmd:MD_MaintenanceFrequencyCode/@codeListValue': 'updateFrequency',

        './/gmd:identificationInfo//gmd:keyword': { dest: 'keywords', multi: true },
        './/gmd:identificationInfo//gmd:topicCategory': { dest: 'topicCategories', multi: true },

        './/gmd:distributionInfo//gmd:transferOptions//gmd:CI_OnlineResource': { dest: 'onlineResources', type: 'Link', multi: true },
        './/gmd:contact': { dest: '_contacts', type: 'Contact', multi: true },
        './/gmd:identificationInfo//gmd:pointOfContact': { dest: 'contacts', type: 'Contact', multi: true },
        './/gmd:identificationInfo//gmd:graphicOverview': { dest: 'graphicOverviews', type: 'GraphicOverview', multi: true },

        // Service
        './/gmd:identificationInfo//srv:serviceType': 'serviceType',
        './/gmd:identificationInfo//srv:couplingType/*/@codeListValue': 'couplingType',
        './/gmd:identificationInfo//srv:coupledResource': { dest: 'coupledResources', type: 'CoupledResource', multi: true }
    },

    Link: {
        './/gmd:linkage': 'link',
        './/gmd:protocol': 'protocol',
        './/gmd:description': 'description',
        './/gmd:name': 'name'
    },

    Contact: {
        './/gmd:organisationName': 'organizationName',
        './/gmd:individualName': 'individualName',
        './/gmd:positionName': 'positionName',
        './/gmd:contactInfo//gmd:phone//gmd:voice': 'phone',
        './/gmd:contactInfo//gmd:phone//gmd:facsimile': 'fax',
        './/gmd:contactInfo//gmd:address//gmd:electronicMailAddress': 'email',
        './/gmd:contactInfo//gmd:address//gmd:deliveryPoint': 'deliveryPoint',
        './/gmd:contactInfo//gmd:address//gmd:city': 'city',
        './/gmd:contactInfo//gmd:address//gmd:postalCode': 'postalCode',
        './/gmd:contactInfo//gmd:address//gmd:country': 'country',
        './/gmd:role/gmd:CI_RoleCode/@codeListValue': 'role'
    },

    GraphicOverview: {
        './/gmd:fileName': 'fileName',
        './/gmd:fileDescription': 'fileDescription',
        './/gmd:fileType': 'fileType'
    },

    Date: {
        './/gmd:date': 'date',
        './/gmd:dateType/gmd:CI_DateTypeCode/@codeListValue': 'type'
    },

    CoupledResource: {
        './/srv:operationName': 'operationName',
        './/srv:identifier': 'identifier',
        './/gco:ScopedName': 'scopedName'
    },

    Extent: {
        './/gmd:description': 'description',
        './/gmd:westBoundLongitude': { dest: 'minX', convert: 'float' },
        './/gmd:eastBoundLongitude': { dest: 'maxX', convert: 'float' },
        './/gmd:southBoundLatitude': { dest: 'minY', convert: 'float' },
        './/gmd:northBoundLatitude': { dest: 'maxY', convert: 'float' }
    }

};


/*
** Helpers
*/
var buildObject, buildArray, buildTextValue;

buildTextValue = function(node, type = 'string') {
    if (!node) return;
    var value;
    if (node.type() === 'attribute') value = node.value();
    if (node.type() === 'element') value = node.text();
    if (!value || value.length === 0) return undefined;
    if (type === 'string') return value;
    if (type === 'integer') return parseInt(value, 10);
    if (type === 'float') return parseFloat(value);
    return value;
};

buildArray = function(nodes, type) {
    if (!nodes || nodes.length === 0) return;
    var result = [];
    nodes.forEach(function(node) {
        var value = type ? buildObject(node, type) : buildTextValue(node);
        if (value) result.push(value);
    });
    return result.length ? result : undefined;
};

buildObject = function(node, type) {
    if (!node) return;
    var result = {};
    _.forEach(definitions[type], function(params, xpath) {
        if (_.isString(params)) params = { dest: params };
        var value;
        if (params.multi) value = buildArray(node.find(xpath, ns), params.type);
        else if (params.type) value = buildObject(node.get(xpath, ns), params.type);
        else value = buildTextValue(node.get(xpath, ns), params.convert);
        if (value) result[params.dest] = value;
    });
    return _.size(result) ? result : undefined;
};

function parseIso(xmlDoc, options) {
    options = options || {};

    var name = xmlDoc.name();
    var namespace = xmlDoc.namespace();

    if (name !== 'MD_Metadata' || namespace.href() !== ns.gmd) {
        debug('Unable to parse record (name: %s, namespace:%s: %s)', name, namespace.prefix(), namespace.href());
        return;
    }

    var result = buildObject(xmlDoc, 'Main');
    if (result && options.keepXml) result._xml = xmlDoc;

    return result;
}

function parse(xmlElement) {
    var result = {};
    var parsedRecord = parseIso(xmlElement);
    var errors = [];
    // var warnings = [];

    function error(message) {
        errors.push({ message: message });
    }

    if (!parsedRecord.fileIdentifier) {
        error('no fileIdentifier found');
    } else {
        result.id = parsedRecord.fileIdentifier;

        if (parsedRecord.fileIdentifier.length > 256) {
            error('fileIdentifier too long (more than 256 characters)');
        } else {
            result.hashedId = hashRecordId(parsedRecord.fileIdentifier);
        }
    }

    if (!parsedRecord._updated) {
        error('no dateStamp found');
    } else {
        if (!_.isDate(new Date(parsedRecord._updated))) {
            error('dateStamp not valid');
        } else {
            result.updatedAt = new Date(parsedRecord._updated);
        }
    }

    result.parsedRecord = parsedRecord;
    result.hashedRecord = hashRecord(parsedRecord);
    result.validationErrors = errors;
    result.valid = errors.length === 0;

    return result;
}

exports.parse = parse;
exports.hashRecordId = hashRecordId;
exports.hashRecord = hashRecord;
