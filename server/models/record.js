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

var RelatedServiceSchema = new Schema({
    name: { type: String, required: true },
    service: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    status: { type: String, enum: ['not-resolved', 'ok', 'unreachable'] },
    protocol: String,
    originalName: String,
    originalLocation: String,
    originalProtocol: String
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
    lastSync: { type: Schema.Types.ObjectId, ref: 'ServiceSync' },
    identifier: {
        type: String,
        index: true
    },
    sourceRecord: { type: Schema.Types.ObjectId, ref: 'CswRecord', unique: true },
    relatedServices: [RelatedServiceSchema],
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
RecordSchema.index({ _id: 1, 'relatedServices.service': 1, 'relatedServices.name': 1 }, { unique: true });

/*
** Methods
*/
RecordSchema.methods.upsertRelatedService = function(service, name) {
    if (!name) return;

    var matchingEntry = _.find(this.relatedServices, { service: service._id, name: name.toLowerCase() });

    var update = {
        service: service.id,
        originalName: name,
        name: name.toLowerCase(),
        protocol: service.protocol
    };

    if (!matchingEntry) {
        update.status = 'not-resolved';
        this.relatedServices.push(update);
    } else {
        _.extend(matchingEntry, update);
    }
};

/*
** Methods
*/
RecordSchema.statics.findByRelatedService = function(service) {
    return this.find({ relatedServices: { $elemMatch: { service: service.id } } });
};

/*
** Attach model
*/
mongoose.model('Record', RecordSchema);
