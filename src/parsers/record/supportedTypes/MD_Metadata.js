var iso19139 = require('iso19139');
var _ = require('lodash');
var stringify = require('json-stable-stringify');

var sha1 = require('../../../helpers/hash').sha1;

function hashRecordId(recordId) {
    return sha1(recordId);
}

function hashRecord(record) {
    return sha1(stringify(_.omit(record, '_updated')));
}

function parse(xmlElement) {
    var result = {};
    var parsedRecord = iso19139.parse(xmlElement);
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
