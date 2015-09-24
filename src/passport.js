/*
** Module dependencies
*/
var passport = require('passport');
var mongoose = require('mongoose');
var User = mongoose.model('User');

/*
** data.gouv.fr Strategy
*/
passport.use('data.gouv.fr', require('./dgfr/authStrategy'));

/*
** Session
*/
passport.serializeUser(function(user, done) {
    done(null, user._id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, done);
});
