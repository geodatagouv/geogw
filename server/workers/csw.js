var _ = require('lodash');
var csw = require('csw-client');
var mongoose = require('../mongoose');
var Record = mongoose.model('Record');
var Service = mongoose.model('Service');
var ServiceSync = mongoose.model('ServiceSync');
var moment = require('moment');
var tld = require('tldjs');
var debug = require('debug')('harvest-csw');
var async = require('async');


var createRelatedService = function(record, resource, protocol, done) {
    // TODO: accept public IP address
    if (!tld.tldExists(resource.link)) {
        debug('related service dropped (TLD not exists) : %s', resource.link);
        return done();
    }

    if (!resource.name) {
        return done();
    }

    Service.findByLocationAndProtocol(resource.link, protocol, function(err, service) {
        if (err) return done(err);

        if (service) {
            record.upsertRelatedService(service, resource.name);
            debug('related service already known');
            return done();
        } 

        if (!service) {
            Service.create({ location: resource.link, protocol: protocol }, function(err, service) {
                if (err) return done(err);

                record.upsertRelatedService(service, resource.name);
                debug('related service has been created!');
                return done();
            });
        }
    });
};

var processOnlineResource = function(record, resource, done) {
    if (!resource.link) return done();
    if (resource.protocol && resource.protocol.toLowerCase().indexOf('wfs') !== -1)  {
        createRelatedService(record, resource, 'wfs', done);
    } else if (resource.protocol && resource.protocol.toLowerCase().indexOf('wms') !== -1)  {
        createRelatedService(record, resource, 'wms', done);
    } else {
        return done(null, resource);
    }
};

var updateRecord = function(job, record, data, serviceSync, done) {
    var metadata = _.pick(data, [
        'title',
        'abstract',
        'type',
        'representationType',
        'serviceType',
        'keywords',
        'contacts',
        '_contacts',
        '_updated'
    ]);

    var processItem = function(onlineResource, done) {
        processOnlineResource(record, onlineResource, done);
    };

    async.map(data.onlineResources || [], processItem, function(err, onlineResources) {
        if (err) return done(err);

        metadata.onlineResources = _.compact(onlineResources);

        record.set('metadata', metadata);
        record.set('lastSync', serviceSync._id);

        record.save(done);
    });
};

var createNewRecord = function(job, data, serviceSync, done) {
    var record = new Record({ identifier: data.fileIdentifier, parentCatalog: serviceSync.service._id });
    updateRecord(job, record, data, serviceSync, done);
};

var processRecord = function(job, data, serviceSync, done) {
    var name = data.title || data.name || data.fileIdentifier;
    // debug('processing record %s', name);

    // Convert input date
    if (data._updated) data._updated = moment(data._updated).toDate();

    Record
        .findOne({ identifier: data.fileIdentifier, parentCatalog: serviceSync.service._id })
        .exec(function(err, record) {
            if (err) return done(err);

            if (!record) {
                job.log('New record ' + name);
                createNewRecord(job, data, serviceSync, done);
            } else {
                if (!data._updated && record.metadata._updated) {
                    job.log('Dropping 1 record: no more _updated attribute!');
                    done();
                } else if (data._updated && moment(record.metadata._updated).isSame(data._updated)) {
                    job.log('Record ' + name + ': not updated');
                    // record.set('lastSync', serviceSync._id).save(done);
                    updateRecord(job, record, data, serviceSync, done);
                } else if (data._updated && moment(record.metadata._updated).isAfter(data._updated)) {
                    job.log('Record ' + name + ': older version found!!!');
                    done();
                } else {
                    job.log('Record ' + name + ': new version found!');
                    updateRecord(job, record, data, serviceSync, done);
                }
            }
        });
};

var harvestService = function(serviceSync, job, done) {
    var client = csw(serviceSync.service.location, {
        maxSockets: job.data.maxSockets || 5,
        keepAlive: true,
        retry: job.data.maxRetry || 3,
        userAgent: 'Afigeo CSW harvester',
        queryStringToAppend: serviceSync.service.locationOptions.query
    });

    var harvesterOptions = {
        mapper: 'iso19139',
        constraintLanguage: 'CQL_TEXT'
    };

    if (serviceSync.service.location.indexOf('isogeo') !== -1) harvesterOptions.namespace = 'xmlns(gmd=http://www.isotc211.org/2005/gmd)';
    if (serviceSync.service.location.indexOf('geoportal/csw/discovery') !== -1) delete harvesterOptions.constraintLanguage;

    var harvester = client.harvest(harvesterOptions);

    var total;

    harvester.on('error', function(err) {
        job.log(JSON.stringify(err));
        console.trace(err);
    });

    harvester.on('start', function(stats) {
        total = stats.matched;
        job.log(JSON.stringify(stats));
    });

    harvester.on('page', function(infos) {
        if (infos.announced < infos.found) {
            total -= (infos.announced - infos.found);
            job.log('Notice: %d records found of %d announced!', infos.found, infos.announced);
        }
    });

    harvester.on('end', function(err, stats) {
        if (err) {
            console.trace(err);
            serviceSync.toggleError(function(mongoErr) {
                if (mongoErr) {
                    console.trace(mongoErr);
                    job.log('Unable to persist status `failed`. Error has been traced to console');
                }
                done(err);
            });
        } else {
            serviceSync.toggleSuccessful(stats.returned, done);
        }
    });

    var q = async.queue(function (data, done) {
        var record = data.record;
        job.progress(data.stats.returned, total);

        if (!record.fileIdentifier) {
            job.log('Dropping 1 record: no fileIdentifier set!');
            return done();
        }

        processRecord(job, record, serviceSync, done);
    }, 1);

    harvester.on('record', function(data) {
        q.push(data);
    });
};

exports.harvest = function(job, done) {
    ServiceSync.findByIdAndProcess(job.data.serviceSyncId, job.id, function(err, serviceSync) {
        if (err) return done(err);
        harvestService(serviceSync, job, done);
    });
};
