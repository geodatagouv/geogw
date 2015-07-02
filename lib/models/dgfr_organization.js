var mongoose = require('mongoose');
var async = require('async');
var _ = require('lodash');

var Schema = mongoose.Schema;

var OrganizationSchema = new Schema({
    _created: Date,
    _updated: Date,

    /* Context */
    name: String,

    /* Configuration */
    sourceCatalog: { type: Schema.Types.ObjectId, required: true },
    publishAll: Boolean,

    /* Usage */
    status: { type: String, enum: ['disabled', 'enabled_private', 'enabled_public'] }

});

OrganizationSchema.methods = {

    fetchWorkingAccessToken: function (done) {
        var User = mongoose.model('User');
        var organization = this;

        User
            .find({ 'organizations._id': organization._id, 'accessToken.value': { $exists: true } })
            .sort('-accessToken._updated')
            .exec(function (err, users) {
                if (err) return done(err);

                var workingAccessToken;

                function stop() {
                    return users.length === 0 || workingAccessToken;
                }

                function iteration(cb) {
                    var user = users.shift();
                    user.synchronize(function (err) {
                        if (err) return cb(err);
                        if (_.find(user.toObject().organizations, { _id: organization.id }) && user.accessToken) {
                            workingAccessToken = user.accessToken.value;
                        }
                        cb();
                    });
                }

                async.until(stop, iteration, function (err) {
                    if (err) return done(err);
                    done(null, workingAccessToken);
                });
            });
    }

};

mongoose.model('Organization', OrganizationSchema);
