import mongoose from 'mongoose';

const Service = mongoose.model('Service');

export function list(req, res, next) {
    Service
        .find({ protocol: 'csw' })
        .exec(function(err, services) {
            if (err) return next(err);
            res.json(services);
        });
}
