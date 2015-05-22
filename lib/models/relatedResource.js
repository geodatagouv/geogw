var mongoose = require('mongoose');
var _ = require('lodash');
var debug = require('debug')('model:related-resource');

var featureTypeMatchings = require('../matching/featureTypes');

var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

var ORIGIN_TYPES = [
    'srv:coupledResource',
    'gmd:onLine'
];

var RESOURCE_TYPES = [
    'feature-type',
    'link',
    'atom-feed'
];

var RelatedResourceSchema = new Schema({

    type: { type: String, required: true, index: true, enum: RESOURCE_TYPES },

    updatedAt: { type: Date, required: true, index: true },
    checking: { type: Boolean, index: true, sparse: true, select: false },

    name: { type: String },

    /* Origin */
    originType: { type: String, enum: ORIGIN_TYPES, required: true, index: true },
    originId: { type: ObjectId, required: true, index: true },
    originCatalog: { type: ObjectId, ref: 'Service', index: true, sparse: true },

    /* Record */
    record: { type: String, required: true, index: true },

    /* FeatureType */
    featureType: {
        candidateName: { type: String },
        candidateLocation: { type: String },
        matchingName: { type: String, index: true, sparse: true },
        matchingService: { type: ObjectId, index: true, sparse: true }
    }

});


/*
** Statics
*/
RelatedResourceSchema.statics = {

    markAsChecking: function (query, done) {
        this.update(query, { $set: { checking: true } }, { multi: true }, done);
    },

    matchFeatureTypeService: function (relatedResource, done) {
        var RelatedResource = this;
        var Service = mongoose.model('Service');
        var r = relatedResource;

        if (!r._id) return done(new Error('_id not defined'));
        if (!r.featureType || !r.featureType.candidateLocation) return done(new Error('candidateLocation must be defined'));
        if (r.featureType.matchingService) return done(new Error('matchingService already defined'));

        var service = {
            location: r.featureType.candidateLocation,
            protocol: 'wfs'
        };

        function finish(serviceId) {
            var query = { _id: r._id };
            var changes = {
                $set: { updatedAt: new Date(), 'featureType.matchingService': serviceId }
            };

            RelatedResource.update(query, changes, function (err) {
                if (err) return done(err);
                done(null, serviceId);
            });
        }

        Service.upsert(service, function (err, upsertedServiceId) {
            if (err) return done(err);
            // If inserted we already have the service id
            if (upsertedServiceId) return finish(upsertedServiceId);

            // Otherwise we have to fetch it (and triggerSync to ensure freshness)
            Service.findOne(service).select({ _id: 1, location: 1, protocol: 1 }).exec(function (err, service) {
                if (err) return done(err);
                if (!service) return done(new Error('Fatal error: unable to fetch existing service'));

                service.doSync(2 * 60 * 60 * 1000, function (err) { // 2 hours
                    if (err) console.log(err);
                    finish(service._id);
                });
            });
        });
    },

    triggerConsolidation: function (relatedResource, done) {
        if (!relatedResource.originCatalog || !relatedResource.record) return done();

        var Record = mongoose.model('Record');

        Record.triggerConsolidateAsDataset({
            hashedId: relatedResource.record,
            parentCatalog: relatedResource.originCatalog
        }, done);
    },

    upsertFeatureType: function (relatedResource, done) {
        var RelatedResource = this;
        var r = relatedResource;

        if (!r.originCatalog || !r.originType || !r.originId) return done(new Error('Bad RelatedResource origin'));
        if (!r.featureType || !r.featureType.candidateName || !r.featureType.candidateLocation) {
            return done(new Error('Bad featureType description'));
        }
        if (!r.record) return done(new Error('record not defined'));

        var query = _.pick(r, 'originType', 'originId', 'originCatalog', 'record');
        query.type = 'feature-type';
        query['featureType.candidateName'] = r.featureType.candidateName;
        query['featureType.candidateLocation'] = r.featureType.candidateLocation;

        var changes = {
            $set: { checking: false },
            $setOnInsert: { updatedAt: new Date() }
        };

        RelatedResource.update(query, changes, { upsert: true }, function (err, rawResponse) {
            if (err) return done(err);
            if (!rawResponse.upserted) {
                debug('not updated for record %s', r.record);
                return done();
            }

            debug('new inserted for record %s', r.record);
            r._id = rawResponse.upserted[0]._id;

            RelatedResource.matchFeatureTypeService(r, function (err, serviceId) {
                if (err) return done(err);
                r.featureType.matchingService = serviceId;
                featureTypeMatchings.resolveByRelatedResource(r, done);
            });

        });
    }

};


mongoose.model('RelatedResource', RelatedResourceSchema);
