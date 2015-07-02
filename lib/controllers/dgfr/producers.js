var mongoose = require('mongoose');

var Producer = mongoose.model('Producer');

exports.list = function (req, res, next) {
    Producer
        .find()
        .populate('associatedTo', 'name')
        .exec(function (err, producers) {
            if (err) return next(err);
            res.send(producers);
        });
};

exports.listByOrganization = function (req, res, next) {
    Producer
        .find({ associatedTo: req.organization._id })
        .select('-associatedTo')
        .exec(function (err, producers) {
            if (err) return next(err);
            res.send(producers);
        });
};

exports.fetch = function (req, res, next, id) {
    Producer.findById(id, function (err, producer) {
        if (err) return next(err);
        if (!producer) return res.sendStatus(404);
        req.producer = producer;
        next();
    });
};

exports.associate = function (req, res, next) {
    Producer.create({ _id: req.body._id, _created: new Date(), associatedTo: req.organization._id }, function (err, producer) {
        if (err) return next(err);
        producer.populate('associatedTo', '+name', function () {
            if (err) return next(err);
            res.send(producer);
        });
    });
};

exports.dissociate = function (req, res, next) {
    if (!req.producer.associatedTo.equals(req.organization._id)) return res.sendStatus(404);
    Producer.findByIdAndRemove(req.producer._id, function (err) {
        if (err) return next(err);
        res.sendStatus(200);
    });
};
