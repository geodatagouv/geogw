/*
** Module dependencies
*/
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var _ = require('lodash');

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

var DateSchema = new Schema({
    date: Date,
    type: { type: String }
}, { _id: false });

/*
** Record schema
*/
var RecordSchema = new Schema({
    parentCatalog: {
        type: Schema.Types.ObjectId,
        ref: 'Service',
        index: true
    },
    lastSync: { type: Schema.Types.ObjectId, ref: 'ServiceSync' },
    identifier: {
        type: String,
        index: true
    },
    hashedId: {
        type: String,
        index: true
    },
    sourceRecord: { type: Schema.Types.ObjectId, ref: 'CswRecord', unique: true },
    organizations: { type: [String], index: true },
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
        lineage: {
            type: String
        },
        history: {
            type: [DateSchema]
        },
        onlineResources: {
            type: [OnlineResourceSchema]
        },
        graphicOverviews: Schema.Types.Mixed,
        contacts: {
            type: [ContactSchema]
        },
        _contacts: {
            type: [ContactSchema]
        },
        _updated: {
            type: Date
        }
    },
    facets: { type: [Schema.Types.Mixed], select: false }
});

/*
** Indexes
*/
var textIndexOptions = {
    default_language: 'french',
    name: 'default_text_index',
    weights: {
        'metadata.title': 10,
        'metadata.keywords': 5,
        'metadata.abstract': 2
    }
};

var textIndexDefinition = {
    'metadata.title': 'text',
    'metadata.abstract': 'text',
    'metadata.keywords': 'text'
};

RecordSchema.index(textIndexDefinition, textIndexOptions);
RecordSchema.index({ 'facets.name': 1, 'facets.value': 1 });


/*
** Attach model
*/
mongoose.model('Record', RecordSchema);
