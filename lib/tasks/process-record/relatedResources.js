/* Module dependencies */
var mongoose = require('mongoose');
var debug = require('debug')('csw-record:related-resources');

var RelatedResource = mongoose.model('RelatedResource');
var Service = mongoose.model('Service');


/* Helpers */
function getRecordIdFromRecord(record) {
    return record._id;
}

function getMatchingServiceId(location, protocol, done) {
    var service = {
        location: location,
        protocol: protocol
    };

    Service.upsert(service, function (err, upsertedServiceId) {
        if (err) return done(err);
        if (upsertedServiceId) return done(err, upsertedServiceId);

        Service.findOne(service).select({ _id: 1, location: 1, protocol: 1 }).exec(function (err, service) {
            if (err) return done(err);
            if (!service) return done(new Error('Fatal error: unable to fetch existing service'));

            service.triggerSync(2 * 60 * 60 * 1000, function (err) { // 2 hours
                if (err) console.log(err);
                done(null, service._id);
            });
        });
    });
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
        originCatalog: record.parentCatalog,
        record: record.hashedId,
        featureType: {
            candidateName: featureType.name,
            candidateLocation: featureType.location
        }
    };

    getMatchingServiceId(featureType.location, 'wfs', function (err, serviceId) {
        relatedResource.featureType.matchingService = serviceId;
        RelatedResource.create(relatedResource, done);
    });
}

/* Exports */
exports.getRecordIdFromRecord = getRecordIdFromRecord;
exports.getMatchingServiceId = getMatchingServiceId;
exports.deleteExisting = deleteExisting;
exports.insertFeatureType = insertFeatureType;