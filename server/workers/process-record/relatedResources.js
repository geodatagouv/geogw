/* Module dependencies */
var mongoose = require('mongoose');
var debug = require('debug')('csw-record:related-resources');

var RelatedResource = mongoose.model('RelatedResource');
var Service = mongoose.model('Service');


/* Helpers */
function getRecordIdFromRecord(record) {
    return record._id;
}

function getMatchingService(location, protocol, done) {
    var query = {
        location: location,
        protocol: protocol
    };
    var changes = {
        $setOnInsert: {
            syncEnabled: true
        }
    };
    Service.findOneAndUpdate(query, changes, { upsert: true, new: true }, done);
}


/* Functions */
function deleteExisting(record, done) {
    var recordId = getRecordIdFromRecord(record);

    RelatedResource.remove({ originId: recordId }, function (err) {
        if (err) return done(err);
        debug('existing entries successfully deleted (%s)', recordId);
        done();
    });
}

function insertFeatureType(record, featureType, done) {
    var recordId = getRecordIdFromRecord(record);

    var relatedResource = {
        type: 'feature-type',
        originId: recordId,
        originType: 'gmd:onLine',
        record: record.hashedId,
        featureType: {
            candidateName: featureType.name,
            candidateLocation: featureType.location
        }
    };

    getMatchingService(featureType.location, 'wfs', function (err, service) {
        relatedResource.featureType.matchingService = service._id;
        RelatedResource.create(relatedResource, done);
    });
}

/* Exports */
exports.getRecordIdFromRecord = getRecordIdFromRecord;
exports.getMatchingService = getMatchingService;
exports.deleteExisting = deleteExisting;
exports.insertFeatureType = insertFeatureType;