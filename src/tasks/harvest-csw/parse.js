var _ = require('lodash');
var sha1 = require('../../../helpers/hash').sha1;
var stringify = require('json-stable-stringify');

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

        if (!parsedRecord.dateStamp) {
            error('no dateStamp found');
        } else {
            if (!_.isDate(parsedRecord.dateStamp)) {
                error('dateStamp not valid');
            } else {
                result.updatedAt = parsedRecord.dateStamp;
            }
        }

        result.parsedRecord = parsedRecord;
        result.hashedRecord = sha1(stringify(_.omit(parsedRecord, 'dateStamp')));
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
