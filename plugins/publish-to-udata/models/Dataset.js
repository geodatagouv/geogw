const mongoose = require('mongoose');
const Promise = require('bluebird');
const sidekick = require('../../../lib/helpers/sidekick');
const dgv = require('../udata');
const { getRecord } = require('../geogw');
const map = require('../mapping').map;
const { setRecordPublication, unsetRecordPublication } = require('./geogw');
const redlock = require('../redlock');

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



const schema = new Schema({
    _id: { type: String },
    title: String,

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
        if (!record) throw new Error('Record not found: ' + this._id);
        if (!record.metadata) throw new Error('Record found but empty metadata: ' + this._id);
        return record;
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
    .then(record => Producer.distinct('associatedTo', { _id: { $in: record.organizations } }).exec())
    .map(organizationId => Organization.findById(organizationId));
});

schema.method('selectTargetOrganization', function () {
  const givenTargetOrganization = this.publication.organization;

  return Promise.join(
    this.getRecord(),
    this.getEligibleOrganizations(),

    function (record, eligibleOrganizations) {
      if (givenTargetOrganization) {
        if (eligibleOrganizations.some(eo => eo._id === givenTargetOrganization)) {
          return givenTargetOrganization;
        } else {
          throw new Error('Given target organization is not eligible');
        }
      } else {
        const targetOrganization =
          eligibleOrganizations.find(eo => eo.publishAll && record.catalogs.includes(eo.sourceCatalog));
        if (targetOrganization) {
          return targetOrganization._id;
        } else {
          throw new Error('No eligible organization found');
        }
      }
    }
  );
});

schema.method('update', function () {
  if (!this.isPublished()) {
    return Promise.reject(new Error('Dataset not published'));
  }
  const datasetId = this.publication._id;

  return Promise
    .join(
      this.computeDataset(),
      this.selectTargetOrganization(this.publication.organization),

      function (dataset, targetOrganization) {
        if (targetOrganization !== this.publication.organization) {
          return dgv.transferDataset(datasetId, targetOrganization).thenReturn(dataset);
        }
        return dataset;
      }
    )
    .then(dataset => dgv.updateDataset(datasetId, dataset))
    .then(publishedDataset => {
      return this
        .set('title', publishedDataset.title)
        .set('publication.updatedAt', new Date())
        .set('publication.organization', publishedDataset.owner)
        .save();
    });
});

schema.method('asyncUpdate', function () {
  if (!this.isPublished()) {
    return Promise.reject(new Error('Dataset not published'));
  }
  return sidekick('udata:synchronizeOne', { recordId: this._id, action: 'update' });
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

        function (dataset, targetOrganization) {
          dataset.owner = targetOrganization;
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
          .set('publication.organization', publishedDataset.owner)
          .save();
      })
      .then(() => {
        const remoteUrl = `${process.env.DATAGOUV_URL}/datasets/${this.publication._id}/`;
        return setRecordPublication(this._id, { remoteId: this.publication._id, remoteUrl });
      })
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

schema.method('unpublish', function () {
  if (!this.isPublished()) {
    return Promise.reject(new Error('Dataset not published'));
  }

  return Promise.resolve(
    dgv.deleteDataset(this.publication._id)
      .then(() => this.remove())
      .then(() => unsetRecordPublication(this._id))
  ).thenReturn(this);
});

schema.method('asyncUnpublish', function () {
  if (!this.isPublished()) {
    return Promise.reject(new Error('Dataset not published'));
  }
  return sidekick('udata:synchronizeOne', { recordId: this._id, action: 'unpublish' });
});

mongoose.model('Dataset', schema);
