var OAuth2Strategy = require('passport-oauth2').Strategy;
var mongoose = require('mongoose');
var _ = require('lodash');
var User = mongoose.model('User');
var dgv = require('./api');

export default new OAuth2Strategy({
    authorizationURL: process.env.DATAGOUV_URL + '/oauth/authorize',
    tokenURL: process.env.DATAGOUV_URL + '/oauth/token',
    clientID: process.env.DATAGOUV_CLIENT_ID,
    clientSecret: process.env.DATAGOUV_CLIENT_SECRET,
    callbackURL: process.env.DATAGOUV_CB_URL
}, function(accessToken, refreshToken, profile, done) {
    dgv.getProfile(accessToken, function (err, profile) {
        if (err) return done(err);

        var fieldsToSet = _.pick(profile, 'first_name', 'last_name', 'email', 'slug');

        var now = new Date();
        fieldsToSet._updated = now;

        fieldsToSet.organizations = profile.organizations.map(function (organization) {
            return { _id: organization.id, name: organization.name };
        });

        fieldsToSet.accessToken = {
            value: accessToken,
            _created: now,
            _updated: now
        };

        var changes = {
            $set: fieldsToSet,
            $setOnInsert: { _created: now }
        };

        User.findByIdAndUpdate(profile.id, changes, { upsert: true, new: true }, done);
    });
});
