const passport = require('passport');
const mongoose = require('mongoose');
const User = mongoose.model('User');

passport.use('udata', require('./auth').strategy);

passport.serializeUser(function(user, done) {
    done(null, user._id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, done);
});
