/*
** Module dependencies
*/
var mongoose = require('mongoose');
var User = mongoose.model('User');

exports.user = function(req, res, next, id) {
    User.findById(id).exec(function(err, user) {
        if (err) return next(err);
        if (!user) return res.send(404);
        req.profile = user; // req.user is used by passport
        next();
    });
};

exports.list = function(req, res, next) {
    User.find().exec(function(err, users) {
        if (err) return next(err);
        res.json(users);
    });
};

exports.show = function(req, res) {
    res.send(req.profile);
};

exports.showCurrentUser = function(req, res) {
    res.send(req.user);
};

exports.subscribe = function(req, res, next) {
    req.user.subscriptions.addToSet(req.service.id);
    req.user.save(function(err) {
        if (err) return next(err);
        res.send(200);
    });
};

exports.unsubscribe = function(req, res, next) {
    req.user.subscriptions.remove(req.service.id);
    req.user.save(function(err) {
        if (err) return next(err);
        res.send(200);
    });
};
