var mongoose = require('mongoose');
var _ = require('lodash');

var jobs = require('../kue').jobs;
var sha1 = require('../helpers/hash').sha1;

var Schema = mongoose.Schema;
var Mixed = Schema.Types.Mixed;


var REMOTE_RESOURCE_TYPES = [
    'page',
    'file-distribution'
];


var RemoteResourceSchema = new Schema({

    location: { type: String, required: true, unique: true },
    hashedLocation: { type: String, required: true, unique: true },

    createdAt: { type: Date },
    touchedAt: { type: Date, index: true },
    updatedAt: { type: Date, index: true },

    type: { type: String, enum: REMOTE_RESOURCE_TYPES, index: true },
    available: { type: Boolean, index: true, sparse: true },

    checkResult: { type: Mixed },

    file: {
        digest: { type: String },
        length: { type: Number },
        downloadedAt: { type: Date },
        dropped: { type: Boolean }
    },

    archive: {
        paths: [String],
        datasets: [String]
    }

});


/*
** Helpers
*/


/*
** Statics
*/
RemoteResourceSchema.statics = {

    triggerCheck: function (remoteResource, done) {
        jobs
            .create('remote-resource:check', {
                remoteResourceId: remoteResource._id,
                remoteResourceLocation: remoteResource.location
            })
            .removeOnComplete(true)
            .save(done);
    },

    upsert: function (remoteResource, done) {
        var RemoteResource = this;

        var now = new Date();
        var aLongTimeAgo = new Date(1970, 1, 1);
        var query = _.pick(remoteResource, 'location');
        var changes = {
            $setOnInsert: {
                createdAt: now,
                touchedAt: aLongTimeAgo,
                updatedAt: aLongTimeAgo,
                hashedLocation: sha1(query.location)
            }
        };

        if (remoteResource.type) {
            changes.$setOnInsert.type = remoteResource.type;
        }

        RemoteResource.update(query, changes, { upsert: true }, function (err, rawResponse) {
            if (err) return done(err);
            if (!rawResponse.upserted) return done(null, false);

            remoteResource._id = rawResponse.upserted[0]._id;

            RemoteResource.triggerCheck(remoteResource, function (err) {
                if (err) console.log(err);
                done(null, true);
            });
        });
    }

};


mongoose.model('RemoteResource', RemoteResourceSchema);
