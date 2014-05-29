/*
** Module dependencies
*/
var passport = require('passport');
var mongoose = require('mongoose');
var User = mongoose.model('User');

/*
** Authentication strategies
*/
passport.use('datagouv', require('./auth/datagouv'));

/*
** Session
*/
passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User
        .findById(id)
        .exec(function(err, user) {
            if (err) return done(err);
            if (!user) return done(new Error('Unable to retrieve session-stored user!'));
            done(null, user);
        });
});

/*
** Exports
*/
module.exports = passport;
