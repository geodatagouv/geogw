/*
** Module dependencies
*/
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

/*
** User schema
*/
var UserSchema = new Schema({
    firstName: {
        type: String
    },
    lastName: {
        type: String
    },
    fullName: {
        type: String
    },
    email: {
        type: String
    },
    avatar: {
        type: String
    },
    datagouv: {
        id: {
            type: String,
            required: true,
            unique: true
        }
    },
    createdAt: {
        type: Date
    },
    updatedAt: {
        type: Date
    },
    subscriptions: [{
        type: Schema.Types.ObjectId,
        ref: 'Service'
    }]
});

UserSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    if (this.isNew && !this.createdAt) this.createdAt = Date.now();
    next();
});

/*
** Attach model
*/
mongoose.model('User', UserSchema);
