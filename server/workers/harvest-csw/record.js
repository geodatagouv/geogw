var iso19139 = require('iso19139');
var moment = require('moment');
var async = require('async');
var _ = require('lodash');

var mongoose = require('../../mongoose');
var jobs = require('../../kue').jobs;

var PersistedCswRecord = mongoose.model('CswRecord');

/*
** Constructor
*/
function CswRecord(xmlElement, job) {
    if (!xmlElement) throw new Error('xmlElement is not defined');
    if (!job) throw new Error('job is not defined');

    this.xmlElement = xmlElement;
    this.recordName = xmlElement.name();
    this.job = job;
    this.parse();
}


/*
** Methods
*/
CswRecord.prototype.parse = function () {
    if (!this.xmlElement) throw new Error('xmlElement is not defined');

    if (this.recordName === 'MD_Metadata') {
        this.parsedRecord = iso19139.parse(this.xmlElement);
    } else {
        this.status = 'not-parsed';
        this.cleanXml();
    }
};

CswRecord.prototype.cleanXml = function () {
    delete this.xmlElement;
};

CswRecord.prototype.isValid = function () {
    if (!this.parsedRecord) return false;

    var record = this;

    function notValid() {
        record.status = 'not-valid';
        return false;
    }

    if (!this.parsedRecord.fileIdentifier) {
        this.job.log('[WARN] Dropping 1 record: no fileIdentifier set!');
        return notValid();
    }

    if (this.parsedRecord.fileIdentifier.length > 256) {
        this.job.log('[WARN] Dropping 1 record: fileIdentifier too long!');
        return notValid();
    }

    if (!this.parsedRecord._updated) {
        this.job.log('[WARN] Dropping 1 record: no dateStamp set!');
        return notValid();
    }

    return true;
};

CswRecord.prototype.timestamp = function () {
    return moment(this.parsedRecord._updated).toDate();
};

CswRecord.prototype.updateCurrentRecord = function (done) {
    var query = {
        parentCatalog: this.job.service._id,
        identifier: this.parsedRecord.fileIdentifier,
        timestamp: this.timestamp()
    };

    var update = { $push: { synchronizations: this.job.id } };

    var job = this.job;
    var record = this;

    PersistedCswRecord.update(query, update, function (err, nModified) {
        if (err) {
            record.cleanXml();
            job.log('[ERROR] Unable to update a CSW record');
            return done(err);
        }

        if (nModified === 0) {
            done(null, false);
        } else if (nModified === 1) {
            record.status = 'not-updated';
            record.cleanXml();
            done(null, true);
        } else {
            record.cleanXml();
            done(new Error('Multiple CSW record updated!!'));
        }
    });
};

CswRecord.prototype.createNewRecord = function (done) {
    var query = {
        parentCatalog: this.job.service._id,
        identifier: this.parsedRecord.fileIdentifier,
        timestamp: this.timestamp(),
        synchronizations: [this.job.id],
        availableSince: this.job.id,
        xml: this.xmlElement.toString()
    };

    this.cleanXml();

    var record = this;

    PersistedCswRecord.collection.insert(query, function (err) {
        if (err) {
            record.job.log('[ERROR] Unable to save a CSW record');
            return done(err);
        }

        record.status = 'created';
        // job.log('[INFO] New CSW record inserted');
        done();
    });
};

CswRecord.prototype.updateOrCreateRecord = function (done) {
    var record = this;

    record.updateCurrentRecord(function (err, updated) {
        if (err) return done(err);
        if (updated) {
            done();
        } else {
            record.createNewRecord(done);
        }
    });
};

CswRecord.prototype.createJob = function (done) {
    jobs
        .create('process-record', {
            recordId: this.parsedRecord.fileIdentifier,
            catalogId: this.job.service._id
        })
        .removeOnComplete(true)
        .save(done);
};

CswRecord.prototype.process = function (done) {
    if (!this.isValid()) {
        this.cleanXml();
        return done();
    }

    async.series([
        _.bind(this.updateOrCreateRecord, this),
        _.bind(this.createJob, this)
    ], done);
};

/*
** Exports
*/
module.exports = CswRecord;
