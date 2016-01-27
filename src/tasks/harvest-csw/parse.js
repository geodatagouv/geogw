var _ = require('lodash');
var sha1 = require('../../helpers/hash').sha1;
var stringify = require('json-stable-stringify');
const debug = require('debug')('geogw:harvester-parse');

function hashRecordId(recordId) {
    return sha1(recordId);
}

var supportedTypes = {
    MD_Metadata: function parse(record) {
        var result = {};
        var parsedRecord = record.body;
        var errors = [];
        // var warnings = [];

        function error(message) {
            debug(message);
            errors.push({ message: message });
        }

        result.id = parsedRecord.fileIdentifier;

        if (parsedRecord.fileIdentifier.length > 256) {
            error('fileIdentifier too long (more than 256 characters)');
        } else {
            result.hashedId = hashRecordId(parsedRecord.fileIdentifier);
        }

        if (!parsedRecord.dateStamp) {
            error('no dateStamp found');
        } else {
            if (!_.isDate(parsedRecord.dateStamp)) {
                error(`dateStamp not valid: ${parsedRecord.dateStamp}`);
            } else {
                result.updatedAt = parsedRecord.dateStamp;
            }
        }

        result.parsedRecord = parsedRecord;
        result.hashedRecord = sha1(stringify(_.omit(parsedRecord, 'dateStamp')));
        result.validationErrors = errors;
        result.valid = errors.length === 0;

        return result;
    },
    Record: function parse(record) {
        var result = {};
        var parsedRecord = record.body;
        var errors = [];
        // var warnings = [];

        function error(message) {
            debug(message);
            errors.push({ message: message });
        }

        result.id = parsedRecord.identifier;

        if (parsedRecord.identifier.length > 256) {
            error('identifier too long (more than 256 characters)');
        } else {
            result.hashedId = hashRecordId(parsedRecord.identifier);
        }

        const updatedAt = parsedRecord.modified || parsedRecord.created;

        if (!updatedAt) {
            error('no modification date found');
        } else {
            if (!_.isDate(updatedAt)) {
                error('modification date not valid');
            } else {
                result.updatedAt = updatedAt;
            }
        }

        result.parsedRecord = parsedRecord;
        result.hashedRecord = sha1(stringify(_.omit(parsedRecord, 'modified')));
        result.validationErrors = errors;
        result.valid = errors.length === 0;

        return result;
    }
};

function parse(record) {
    var recordType = record.type;
    var parseResult = { recordType: recordType };

    if (recordType in supportedTypes) {
        _.assign(parseResult, supportedTypes[recordType](record));
    }

    return parseResult;
}

exports.parse = parse;
