var _ = require('lodash');

var supportedTypes = {
    'MD_Metadata': require('./supportedTypes/MD_Metadata')
};

function parse(xmlElement) {
    var recordType = xmlElement.name();
    var parseResult = { recordType: recordType };

    if (recordType in supportedTypes) {
        _.assign(parseResult, supportedTypes[recordType].parse(xmlElement));
    }

    return parseResult;
}

exports.parse = parse;
