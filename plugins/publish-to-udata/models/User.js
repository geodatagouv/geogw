var mongoose = require('mongoose');

var dgv = require('../udata');

var Schema = mongoose.Schema;

var OrganizationSchema = new Schema({
    _id: { type: String, index: true },
    name: { type: String }
});

var UserSchema = new Schema({
    _id: String,
    _created: Date,
    _updated: Date,
    organizations: [OrganizationSchema],

    /* Context */
    first_name: String,
    last_name: String,
    email: String,
    slug: String,

    /* OAuth */
    accessToken: {
        value: { type: String, index: true },
        _created: { type: Date },
        _updated: { type: Date }
    },

    isAdmin: Boolean
});

UserSchema.methods = {

    synchronize: function (done) {
        var user = this;
        if (!user.accessToken) return done();

        dgv.getProfile(user.accessToken.value, function (err, profile) {
            if (err && err.message === 'Unauthorized') {
                return user.set('accessToken', null).save(done);
            }
            if (err) return done(err);
            user.set('organizations', profile.organizations.map(function (organization) {
                return { _id: organization.id, name: organization.name };
            })).save(done);
        });
    }

};

mongoose.model('User', UserSchema);
