var async = require('async');
var _ = require('lodash');

var mongoose = require('../../mongoose');
var jobs = require('../../kue').jobs;
var parseRecord = require('../../parsers/record').parse;

var Record = mongoose.model('Record');

/*
** Constructor
*/
function CswRecord(xmlElement, job) {
    _.assign(this, parseRecord(xmlElement));
    this.job = job;
}


/*
** Methods
*/
CswRecord.prototype.touchExistingRecord = function (done) {
    var query = {
        parentCatalog: this.job.service._id,
        hashedId: this.hashedId,
        dateStamp: this.updatedAt
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
        } else {
            record.status = 'not-updated';
            done(null, true);
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
            identifier: this.id
        },
        $set: {
            metadata: this.parsedRecord,
            dateStamp: this.updatedAt
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
    if (!this.parsedRecord && !this.valid) return done();

    async.series([
        _.bind(this.updateOrCreateRecord, this),
        _.bind(this.createJob, this)
    ], done);
};

/*
** Exports
*/
module.exports = CswRecord;
