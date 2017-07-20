const mongoose = require('mongoose');

const Record = mongoose.model('ConsolidatedRecord');

async function handleIncomingWebHook({ linkId }) {
  const relatedRecordIds = await Record
    .distinct('recordId', { 'links.ids': linkId })
    .exec();

  const updatingRecords = relatedRecordIds
    .map(id => Record.triggerUpdated(id, 'link checked'));

  await Promise.all(updatingRecords);
}

function handleIncomingWebHookTask(job, done) {
  handleIncomingWebHook(job.data)
    .then(() => done())
    .catch(done);
}

module.exports = handleIncomingWebHookTask;
