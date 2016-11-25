const mongoose = require('mongoose');
const Promise = require('bluebird');

const dgv = require('../udata');
const map = require('../mapping').map;
const { setRecordPublication, unsetRecordPublication } = require('./geogw');

const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const DatasetSchema = new Schema({
    _id: { type: String },

    // Attributes related to the publication on the udata platform
    publication: {
        // Unique ID on the udata platform
        _id: { type: String, unique: true, sparse: true },

        // Organization on the udata platform which hold the dataset
        organization: { type: ObjectId, ref: 'Organization' },

        // Published dataset revision
        revision: { type: Date },

        createdAt: { type: Date },
        updatedAt: { type: Date, index: true, sparse: true }
    }

});

DatasetSchema.methods = {

    fetchAndConvert: function () {
      if (!this.publication || !this.publication.organization) {
        return Promise.reject(new Error('Target organization not set'));
      }

      const ConsolidatedRecord = mongoose.model('ConsolidatedRecord');

      return ConsolidatedRecord
        .findOne({ recordId: this._id })
        .exec()
        .then(sourceDataset => {
          if (!sourceDataset) throw new Error('Record not found: ' + this._id);
          if (!sourceDataset.metadata) throw new Error('Record found but empty metadata: ' + this._id);
          const uDataset = map(sourceDataset);
          uDataset.organization = this.publication.organization;
          return uDataset;
        });
    },

    synchronize: function (done) {
      if (!this.publication || !this.publication._id) {
        return Promise.reject(new Error('Dataset not published'));
      }

      return Promise.resolve(
        this.fetchAndConvert()
          .then(uDataset => dgv.updateDataset(this.publication._id, uDataset))
          .then(() => this.set('publication.updatedAt', new Date()).save())
      ).asCallback(done);
    },

    publish: function (done) {
      return Promise.resolve(
        this.fetchAndConvert()
          .then(uDataset => dgv.createDataset(uDataset))
          .then(uDataset => {
            const now = new Date();
            return this
              .set('publication.updatedAt', now)
              .set('publication.createdAt', now)
              .set('publication._id', uDataset.id)
              .save();
          })
          .then(() => {
            const remoteUrl = `${process.env.DATAGOUV_URL}/datasets/${this.publication._id}/`;
            return setRecordPublication(this._id, { remoteId: this.publication._id, remoteUrl });
          })
      ).asCallback(done);
    },

    unpublish: function (done) {
      if (!this.publication || !this.publication._id) {
        return Promise.reject(new Error('Dataset not published'));
      }

      return Promise.resolve(
        dgv.deleteDataset(this.publication._id)
          .then(() => this.remove())
          .then(() => unsetRecordPublication(this._id))
      ).thenReturn().asCallback(done);
    },

};

mongoose.model('Dataset', DatasetSchema);
