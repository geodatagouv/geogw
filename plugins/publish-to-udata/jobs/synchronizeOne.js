const mongoose = require('mongoose');
const Dataset = mongoose.model('Dataset');

module.exports = function (job, jobDone) {
    const { recordId, organizationId, unpublishIfRecordNotFound, removeIfTargetDatasetNotFound } = job.data;
    let { action } = job.data;

    Dataset.findById(recordId).exec()
      .then(foundPublicationInfo => {
        if (!foundPublicationInfo && action && ['update', 'unpublish'].includes(action)) {
          throw new Error('Cannot update or unpublish a non published dataset');
        }
        if (foundPublicationInfo && !action) {
          action = 'update';
        }
        if (!foundPublicationInfo && !action) {
          action = 'publish';
        }

        const publicationInfo = foundPublicationInfo || new Dataset({ _id: recordId, 'publication.organization': organizationId });

        return publicationInfo[action]()
          .catch(err => {
            if (err.message === 'Unchanged dataset') {
              job.log('Unchanged dataset');
              return;
            }
            if (unpublishIfRecordNotFound && err.message === 'Record not found' && action === 'update') {
              job.log('Source record not found. Going to unpublish the related dataset...');
              return publicationInfo.unpublish();
            }
            if (removeIfTargetDatasetNotFound && err.message === 'Target dataset doesn\'t exist anymore' && action === 'update') {
              job.log('Target dataset not found. Going to remove the publication info...');
              return publicationInfo.removeAndNotify();
            }
            throw err;
          });
      })
      .thenReturn()
      .then(jobDone)
      .catch(err => {
        if (err.status && err.response) {
          job.log(`Error ${err.status}`);
          job.log(err.response.body);
        }
        jobDone(err);
      });
};
