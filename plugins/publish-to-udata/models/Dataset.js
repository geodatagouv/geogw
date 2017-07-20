'use strict';

const mongoose = require('mongoose');
const Promise = require('bluebird');
const sidekick = require('../../../lib/helpers/sidekick');
const dgv = require('../udata');
const map = require('../mapping').map;
const { createHash } = require('crypto');
const { getRecord, setRecordPublication, unsetRecordPublication } = require('../geogw');
const redlock = require('../redlock');
const stringify = require('json-stable-stringify');

const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

function clearLock(lock, err) {
  return lock.unlock().then(() => { if (err) throw err; });
}

function getPublicationLock(recordId) {
  return redlock.lock(`udata:${recordId}:publish`, 10000)
    .then(lock => {
      return mongoose.model('Dataset').findById(recordId).exec()
        .then(publication => {
          if (publication) throw new Error('Dataset already published');
          return lock;
        })
        .catch(err => clearLock(lock, err)); // Release lock
    });
}

function getHash(dataset) {
    return createHash('sha1').update(stringify(dataset), 'utf8').digest('hex');
}



const schema = new Schema({
    _id: { type: String },

    title: String,

    hash: String,

    // Attributes related to the publication on the udata platform
    publication: {
        // Unique ID on the udata platform
        _id: { type: String, unique: true, required: true },

        // Organization on the udata platform which hold the dataset
        organization: { type: ObjectId, ref: 'Organization', required: true },

        // Published dataset revision
        revision: { type: Date },

        createdAt: { type: Date },
        updatedAt: { type: Date, index: true, sparse: true }
    }

});

schema.method('isPublished', function () {
  return this.publication && this.publication._id;
});

schema.method('getRecord', function () {
  if (!this.getRecordPromise) {
    this.getRecordPromise = getRecord(this._id)
      .then(record => {
        if (!record.metadata) throw new Error('Record found but empty metadata: ' + this._id);
        return record;
      })
      .catch(err => {
        if (err.status === 404) throw new Error('Record not found');
        throw err;
      });
  }
  return this.getRecordPromise;
});

schema.method('computeDataset', function () {
  return this.getRecord().then(map);
});



schema.method('getEligibleOrganizations', function () {
  const Producer = mongoose.model('Producer');
  const Organization = mongoose.model('Organization');

  return this.getRecord()
    .then(record => {
      return Producer.distinct('associatedTo', { _id: { $in: record.organizations } }).exec()
        .map(organizationId => Organization.findById(organizationId))
        .filter(organization => record.catalogs.some(c => {
          return organization.sourceCatalogs.some(sourceCatalog => sourceCatalog.equals(c));
        }));
    });
});

schema.method('selectTargetOrganization', function () {
  const currentOrganization = this.publication.organization;

  return Promise.join(
    this.getRecord(),
    this.getEligibleOrganizations(),

    function (record, eligibleOrganizations) {
      // current organization is eligible
      if (currentOrganization && eligibleOrganizations.some(eo => eo._id.equals(currentOrganization))) {
        return currentOrganization;
      }

      const electedOrganization = eligibleOrganizations.find(eo => eo.publishAll);

      // we elected an organization
      if (electedOrganization) {
        return electedOrganization._id;
      }

      // we fall back to current organization
      if (currentOrganization) {
        return currentOrganization
      }

      throw new Error('No eligible organization found!');
    }
  );
});

schema.method('update', function (options = {}) {
  if (!this.isPublished()) {
    return Promise.reject(new Error('Dataset not published'));
  }
  const datasetId = this.publication._id;

  return Promise
    .join(
      this.computeDataset(),
      this.selectTargetOrganization(this.publication.organization),

      (dataset, targetOrganization) => {
        if (targetOrganization !== this.publication.organization) {
          return this.transferTo(targetOrganization)
            .catch(err => {
              if (err.message === 'Dataset doesn\'t exist') {
                throw new Error('Target dataset doesn\'t exist anymore');
              }
              throw err;
            })
            .thenReturn(dataset);
        }
        return dataset;
      }
    )
    .then(dataset => {
      const hash = getHash(dataset);
      if (!options.force && this.hash && this.hash === hash) throw new Error('Unchanged dataset');
      this.set('hash', hash);
      return dataset;
    })
    .then(dataset => {
      return dgv.updateDataset(datasetId, dataset)
        .catch(err => {
          if (err.status === 404) throw new Error('Target dataset doesn\'t exist anymore');
          throw err;
        });
    })
    .then(publishedDataset => {
      return this
        .set('title', publishedDataset.title)
        .set('publication.updatedAt', new Date())
        .set('publication.organization', publishedDataset.organization.id)
        .save();
    });
});

schema.method('asyncUpdate', function (additionalSidekickOptions = {}) {
  if (!this.isPublished()) {
    return Promise.reject(new Error('Dataset not published'));
  }
  return sidekick('udata:synchronizeOne', Object.assign({}, additionalSidekickOptions, { recordId: this._id, action: 'update' }));
});

schema.method('notifyPublication', function () {
  const remoteUrl = `${process.env.DATAGOUV_URL}/datasets/${this.publication._id}/`;
  return setRecordPublication(this._id, { remoteId: this.publication._id, remoteUrl });
});

schema.method('publish', function () {
  if (this.isPublished()) {
    return Promise.reject(new Error('Dataset already published'));
  }

  return getPublicationLock(this._id).then(lock => {
    return Promise
      .join(
        this.computeDataset(),
        this.selectTargetOrganization(this.publication.organization),

        (dataset, targetOrganization) => {
          this.set('hash', getHash(dataset));
          dataset.organization = targetOrganization;
          return dgv.createDataset(dataset);
        }
      )
      .then(publishedDataset => {
        const now = new Date();
        return this
          .set('title', publishedDataset.title)
          .set('publication.updatedAt', now)
          .set('publication.createdAt', now)
          .set('publication._id', publishedDataset.id)
          .set('publication.organization', publishedDataset.organization.id)
          .save();
      })
      .then(() => this.notifyPublication())
      .then(() => clearLock(lock))
      .thenReturn(this)
      .catch(err => clearLock(lock, err));
  });
});

schema.method('asyncPublish', function ({ organizationId }) {
  if (this.isPublished()) {
    return Promise.reject(new Error('Dataset already published'));
  }
  return sidekick('udata:synchronizeOne', { recordId: this._id, action: 'publish', organizationId });
});

schema.method('removeAndNotify', function () {
  return this.remove()
    .then(() => unsetRecordPublication(this._id))
    .catch(err => {
      if (err.status === 404) return;
      throw err;
    })
    .thenReturn(this);
});

schema.method('unpublish', function () {
  if (!this.isPublished()) {
    return Promise.reject(new Error('Dataset not published'));
  }

  return Promise.resolve(
    dgv.deleteDataset(this.publication._id)
      .then(() => this.removeAndNotify())
  ).thenReturn(this);
});

schema.method('asyncUnpublish', function () {
  if (!this.isPublished()) {
    return Promise.reject(new Error('Dataset not published'));
  }
  return sidekick('udata:synchronizeOne', { recordId: this._id, action: 'unpublish' });
});

schema.method('transferTo', function (targetOrganization, force = false) {
  if (targetOrganization === this.publication.organization && !force) {
    return Promise.resolve(this);
  }

  return dgv.transferDataset(this.publication._id, targetOrganization)
    .then(() => this.set('publication.organization', targetOrganization).save());
});

schema.static('asyncSynchronizeAll', function (options) {
  return sidekick('udata:synchronizeAll', options);
});

mongoose.model('Dataset', schema);
