var url = require('../../url');
var _ = require('lodash');

var QUERYSTRING_BLACKLIST = {
    service: true,
    version: true,
    request: true,
    typenames: true,
    typename: true,
    exceptions: true,
    outputformat: true,
    featureid: true,
    count: true,
    maxfeatures: true,
    sortby: true,
    propertyname: true,
    srsname: true,
    bbox: true,
    valuereference: true,
    'format-options': true
};

exports.parseLocation = function(location) {
    var result = {};
    var l = url.normalize(url.parse(location, true), { removeKeys: QUERYSTRING_BLACKLIST });
    result.location = url.format(_.pick(l, 'protocol', 'hostname', 'port', 'pathname'));
    result.locationOptions = { query: l.query };
    return result;
};

exports.syncable = true;
