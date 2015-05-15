var iso19139 = require('iso19139');
var moment = require('moment');
var async = require('async');
var _ = require('lodash');

var mongoose = require('../../mongoose');
var jobs = require('../../kue').jobs;
var hashRecordId = require('../../utils');

var Record = mongoose.model('Record');

/*
** Constructor
*/
function CswRecord(xmlElement, job) {
    if (!xmlElement) throw new Error('xmlElement is not defined');
    if (!job) throw new Error('job is not defined');

    this.recordName = xmlElement.name();
    this.job = job;
    this.parse(xmlElement);
}


/*
** Methods
*/
CswRecord.prototype.parse = function (xmlElement) {
    if (this.recordName === 'MD_Metadata') {
        this.parsedRecord = iso19139.parse(xmlElement);
        this.hashedId = hashRecordId(this.parsedRecord.fileIdentifier);
    } else {
        this.status = 'not-parsed';
    }
};

CswRecord.prototype.isValid = function () {
    if (!this.parsedRecord) return false;

    var record = this;

    function notValid() {
        record.status = 'not-valid';
        return false;
    }

    if (!this.parsedRecord.fileIdentifier) {
        this.job.log('[DROP] No fileIdentifier set.');
        return notValid();
    }

    if (this.parsedRecord.fileIdentifier.length > 256) {
        this.job.log('[DROP] fileIdentifier too long: %s', this.parsedRecord.fileIdentifier);
        return notValid();
    }

    if (!this.parsedRecord._updated) {
        this.job.log('[DROP] No dateStamp found for %s', this.parsedRecord.fileIdentifier);
        return notValid();
    }

    if (!_.isDate(new Date(this.parsedRecord._updated))) {
        this.job.log('[DROP] dateStamp not valid for %s, given: %s', this.parsedRecord.fileIdentifier, this.parsedRecord._updated);
        return notValid();
    }

    return true;
};

CswRecord.prototype.timestamp = function () {
    return moment(this.parsedRecord._updated).toDate();
};

CswRecord.prototype.touchExistingRecord = function (done) {
    var query = {
        parentCatalog: this.job.service._id,
        hashedId: this.hashedId,
        dateStamp: this.timestamp()
    };

    var update = { $currentDate: { touchedAt: 1 } };

    var job = this.job;
    var record = this;

    Record.update(query, update, function (err, rawResponse) {
        if (err) {
            job.log('[ERROR] Unable to update a CSW record');
            return done(err);
        }

        if (rawResponse.nModified === 0) {
            done(null, false);
        } else if (rawResponse.nModified === 1) {
            record.status = 'not-updated';
            done(null, true);
        } else {
            done(new Error('Multiple CSW record updated!!'));
        }
    });
};

CswRecord.prototype.upsertRecord = function (done) {
    var query = {
        parentCatalog: this.job.service._id,
        hashedId: this.hashedId
    };

    var changes = {
        $currentDate: {
            updatedAt: 1,
            touchetAt: 1
        },
        $setOnInsert: {
            identifier: this.parsedRecord.fileIdentifier
        },
        $set: {
            metadata: this.parsedRecord,
            dateStamp: this.timestamp()
        }
    };

    var record = this;

    Record.update(query, changes, { upsert: true }, function (err, rawResponse) {
        if (err) {
            record.job.log('[ERROR] Unable to save a CSW record');
            return done(err);
        }

        record.status = rawResponse.upserted ? 'created' : 'updated';
        done();
    });
};

CswRecord.prototype.touchOrUpsertRecord = function (done) {
    var record = this;

    record.touchExistingRecord(function (err, touched) {
        if (err) return done(err);
        if (touched) return done();
        record.upsertRecord(done);
    });
};

CswRecord.prototype.createJob = function (done) {
    if (this.status !== 'created') return done();

    jobs
        .create('process-record', {
            hashedId: this.hashedId,
            catalogId: this.job.service._id
        })
        .removeOnComplete(true)
        .attempts(5)
        .save(done);
};

CswRecord.prototype.process = function (done) {
    if (!this.isValid()) return done();

    async.series([
        _.bind(this.updateOrCreateRecord, this),
        _.bind(this.createJob, this)
    ], done);
};

/*
** Exports
*/
module.exports = CswRecord;
