'use strict';

const mongoose = require('mongoose');
const Dataset = mongoose.model('Dataset');
const { getPublications, unsetRecordPublication } = require('../geogw');
const Promise = require('bluebird');

module.exports = function (job, jobDone) {
  getPublications()
    .then(currentPublications => new Set(currentPublications.map(p => p.recordId)))
    .then(publishedRecordIds => {
      return Dataset.find().exec()
        .each(dataset => {
          if (publishedRecordIds.has(dataset._id)) {
            publishedRecordIds.delete(dataset._id);
            return dataset.asyncUpdate(job.data);
          } else {
            return dataset.notifyPublication()
              .then(() => dataset.asyncUpdate(job.data));
          }
        })
        .then(() => Promise.each(Array.from(publishedRecordIds), unsetRecordPublication));
    })
    .thenReturn()
    .then(jobDone)
    .catch(jobDone);
};
