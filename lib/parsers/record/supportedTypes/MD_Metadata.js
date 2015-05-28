var iso19139 = require('iso19139');
var _ = require('lodash');
var crypto = require('crypto');
var stringify = require('json-stable-stringify');

function hashRecordId(recordId) {
    return crypto.createHash('sha1').update(recordId, 'utf8').digest('hex');
}

function hashRecord(record) {
    var str = stringify(_.omit(record, '_updated'));
    return crypto.createHash('sha1').update(str, 'utf8').digest('hex');
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
