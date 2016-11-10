const Promise = require('bluebird');
const mongoose = require('mongoose');
const Organization = mongoose.model('Organization');
const Dataset = mongoose.model('Dataset');
const dgv = require('./udata');
const convertToUdataDataset = require('./mapping').map;
const ObjectId = mongoose.Types.ObjectId;
const { setRecordPublication, unsetRecordPublication } = require('./geogw');

function getAccessToken(owner) {
    return Organization.fetchWorkingAccessTokenFor(owner);
}

function getConvertedDataset(dataset, owner, isPrivate) {
    return Promise.try(() => {
        const convertedDataset = convertToUdataDataset(dataset);
        convertedDataset.organization = owner;
        convertedDataset.private = isPrivate;
        return convertedDataset;
    });
}

function publishDataset(dataset, options) {
    options = options || {};
    if (!options.owner) throw new Error('Required option: owner');
    const dgvAction = options.id ? dgv.updateDataset.bind(null, options.id) : dgv.createDataset;

    return Promise.using(
        getAccessToken(options.owner),
        getConvertedDataset(dataset, options.owner, options.publicationStatus === 'private'),

        function (accessToken, convertedDataset) {
            return Promise.fromCallback(
                cb => dgvAction(convertedDataset, accessToken, cb),
                { multiArgs: true }
            );
        }
    )
    .then(publicationResults => {
        const publishedDataset = publicationResults[0];
        const withErrors = publicationResults[1];
        const now = new Date();
        const changes = {
            $setOnInsert: {
                'publication.createdAt': now,
                'publication._id': publishedDataset.id
            },
            $set: {
                'publication.updatedAt': now,
                'publication.withErrors': withErrors,
                'publication.organization': new ObjectId(publishedDataset.organization.id),
                'publication.status': publishedDataset.private ? 'private' : 'public'
            }
        };

        return Dataset.findByIdAndUpdate(dataset.recordId, changes, { upsert: true })
            .then(() => setRecordPublication(dataset.recordId, { remoteId: publishedDataset.id }))
            .then(() => ({
                organization: publishedDataset.organization.id,
                status: publishedDataset.private ? 'private' : 'public',
                id: publishedDataset.id
            }));
    });
}

function unpublishDataset(dataset, options) {
    options = options || {};
    if (!options.id) throw new Error('Required option: id');
    if (!options.owner) throw new Error('Required option: owner');

    return getAccessToken(options.owner)
        .then(accessToken => Promise.fromCallback(cb => dgv.deleteDataset(options.id, accessToken, cb)))
        .then(() => Dataset.findByIdAndRemove(dataset.recordId).exec())
        .then(() => unsetRecordPublication(dataset.recordId));
}

module.exports = { unpublishDataset, publishDataset };
