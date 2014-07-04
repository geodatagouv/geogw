/*
** Module dependencies
*/
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

/*
** Online resource schema
*/
var OnlineResourceSchema = new Schema({
    name: {
        type: String
    },
    link: {
        type: String
    },
    protocol: {
        type: String
    },
    description: {
        type: String
    }
});

/*
** Contact schema
*/
var ContactSchema = new Schema({
    organizationName: {
        type: String
    },
    individualName: {
        type: String
    },
    positionName: {
        type: String
    },
    email: {
        type: String
    },
    role: {
        type: String
    }
});

/*
** Record schema
*/
var RecordSchema = new Schema({
    parentCatalog: {
        type: Schema.Types.ObjectId,
        ref: 'Service',
        index: true
    },
    lastSync: { type: Schema.Types.ObjectId, ref: 'ServiceSync', required: true },
    identifier: {
        type: String,
        index: true
    },
    metadata: {
        title: {
            type: String
        },
        abstract: {
            type: String
        },
        type: {
            type: String,
            index: true
        },
        representationType: {
            type: String,
            index: true
        },
        serviceType: {
            type: String,
            index: true
        },
        keywords: {
            type: [String],
            index: true
        },
        onlineResources: {
            type: [OnlineResourceSchema]
        },
        contacts: {
            type: [ContactSchema]
        },
        _contacts: {
            type: [ContactSchema]
        },
        _updated: {
            type: Date
        }
    }
});

RecordSchema.index({
    'metadata.title': 'text',
    'metadata.abstract': 'text',
    'metadata.keywords': 'text'
}, {
    default_language: 'french',
    name: 'default_text_index',
    weights: {
        'metadata.title': 10,
        'metadata.keywords': 5,
        'metadata.abstract': 2
    }
});

/*
** Attach model
*/
mongoose.model('Record', RecordSchema);
