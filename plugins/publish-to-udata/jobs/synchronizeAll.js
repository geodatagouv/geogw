const mongoose = require('mongoose');
const Dataset = mongoose.model('Dataset');

module.exports = function (job, jobDone) {
  Dataset.find().limit(500).exec()
    .map(dataset => dataset.asyncUpdate(), { concurrency: 10 })
    .thenReturn()
    .then(jobDone)
    .catch(jobDone);
};
