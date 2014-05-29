/*
** Module dependencies
*/
var OAuth2Strategy = require('passport-oauth').OAuth2Strategy;
var request = require('superagent');
var mongoose = require('mongoose');
var User = mongoose.model('User');

/*
** DataGouv Strategy
*/
module.exports = new OAuth2Strategy({
    authorizationURL: 'https://id.data.gouv.fr/oauth2/authorize/',
    tokenURL: 'https://id.data.gouv.fr/oauth2/token/',
    clientID: process.env.DATAGOUV_CLIENT_ID,
    clientSecret: process.env.DATAGOUV_CLIENT_SECRET,
    callbackURL: process.env.DATAGOUV_CB_URL
}, function(accessToken, refreshToken, profile, done) {

    request.get('https://id.data.gouv.fr/api/me')
        .set('authorization', 'Bearer ' + accessToken)
        .end(function(err, resp) {
            if (err) return done(err);
            if (resp.error) return done(new Error('DataGouv identity retrieving failed!'));
            if (!resp.body || !resp.body.slug) return done(new Error('DataGouv has returned unattended content!'));

            var update = {
                firstName: resp.body.first_name,
                lastName: resp.body.last_name,
                fullName: resp.body.fullname,
                email: resp.body.email,
                avatar: resp.body.profile.avatar,
                updatedAt: Date.now()
            };

            User.findOne({ 'datagouv.id': resp.body.slug }, function(err, user) {
                if (err) return done(err);
                if (!user) user = new User({ 'datagouv.id': resp.body.slug });
                user.set(update);
                user.save(function(err) {
                    if (err) return done(err);
                    done(null, user);
                });
            });
        });
        
});
