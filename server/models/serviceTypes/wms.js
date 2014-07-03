var url = require('../../url');
var _ = require('lodash');

var QUERYSTRING_BLACKLIST = {
    service: true,
    version: true,
    request: true,
    exceptions: true,
    layer: true,
    layers: true,
    styles: true,
    srs: true,
    crs: true,
    width: true,
    height: true,
    format: true,
    transparent: true,
    bgcolor: true,
    time: true,
    sld: true,
    sld_body: true,
    query_layers: true,
    info_format: true,
    feature_count: true,
    x: true,
    i: true,
    y: true,
    j: true,
    buffer: true,
    cql_filter: true,
    filter: true,
    propertyname: true,
    bbox: true,
    outputFormat: true
};

exports.parseLocation = function(location) {
    var result = {};
    var l = url.normalize(url.parse(location, true), { removeKeys: QUERYSTRING_BLACKLIST });
    result.location = url.format(_.pick(l, 'protocol', 'hostname', 'port', 'pathname'));
    result.locationOptions = { query: l.query };
    return result;
};

exports.syncable = false;
