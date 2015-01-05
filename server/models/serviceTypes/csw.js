var url = require('../../url');
var _ = require('lodash');

var QUERYSTRING_BLACKLIST = {
    service: true,
    version: true,
    request: true,
    typenames: true,
    typename: true,
    namespace: true,
    outputformat: true,
    resulttype: true,
    requestid: true,
    outputschema: true,
    startposition: true,
    maxrecords: true,
    elementsetname: true,
    elementname: true,
    constraintlanguage: true,
    constraint: true,
    sortby: true,
    distributedsearch: true,
    hopcount: true,
    responsehandler: true
};

exports.parseLocation = function(location) {
    var result = {};
    var l = url.normalize(url.parse(location, true), { removeKeys: QUERYSTRING_BLACKLIST });
    result.location = url.format(_.pick(l, 'protocol', 'hostname', 'port', 'pathname'));
    result.locationOptions = { query: l.query };
    return result;
};

exports.syncTask = 'harvest-csw';

exports.syncable = true;
