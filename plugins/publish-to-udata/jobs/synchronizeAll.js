const mongoose = require('mongoose');
const Dataset = mongoose.model('Dataset');

module.exports = function (job, jobDone) {
  Dataset.find().limit().exec()
    .map(dataset => dataset.asyncUpdate(job.data), { concurrency: 10 })
    .thenReturn()
    .then(jobDone)
    .catch(jobDone);
};
