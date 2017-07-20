'use strict';

const mongoose = require('mongoose');
const Promise = require('bluebird');
const Plunger = require('../../helpers/plunger');
const strRightBack = require('underscore.string/strRightBack');
const { isEqual, omit } = require('lodash');

const RemoteResource = mongoose.model('RemoteResource');
const RelatedResource = mongoose.model('RelatedResource');


class RemoteResourceCheck {

    constructor(options = {}) {
        this.options = options;
        this.now = new Date();
    }

    getRemoteResource() {
        if (this.remoteResource) return Promise.resolve(this.remoteResource);

        return RemoteResource
            .findOne({ location: this.options.remoteResourceLocation })
            .select('-checkResult')
            .exec()
            .then(remoteResource => {
                if (!remoteResource) throw new Error('RemoteResource not found');
                this.remoteResource = remoteResource;
                return remoteResource;
            });
    }

    checkResource() {
        if (this.checkResult) return Promise.resolve(this.checkResult);

        this.checker = new Plunger(this.options.remoteResourceLocation, { abort: 'never' });
        return this.checker.inspect()
            .then(() => {
                const checkResult = this.checker.toObject();
                checkResult.headers = omit(checkResult.headers, 'set-cookie', 'connection');
                this.remoteResource.checkResult = checkResult;
                return checkResult;
            });
    }

    archiveIsTooLarge() {
        this.archiveMixedContent();
        this.remoteResource.set('checkResult.archiveTooLarge', true);
    }

    archiveMixedContent() {
        this.remoteResource
            .set('available', true)
            .set('type', 'unknown-archive');
    }

    handleArchive() {
        return this.checker.saveArchive()
            .then(() => this.checker.decompressArchive())
            .then(() => this.checker.listFiles())
            .then(files => {
                this.remoteResource
                    .set('archive.files', files.all)
                    .set('archive.datasets', files.datasets)
                    .set('checkResult.digest', this.checker.digest.toString('hex'))
                    .set('checkResult.size', this.checker.readBytes);

                if (files.datasets.length === 0) {
                    return this.archiveMixedContent();
                }

                this.remoteResource
                    .set('available', true)
                    .set('type', 'file-distribution');
            })
            .finally(() => this.checker.cleanup());
    }

    saveChanges() {
        if (!this.remoteResource) return Promise.resolve();

        return this.remoteResource
            .set('updatedAt', this.now)
            .set('touchedAt', this.now)
            .save();
    }

    propagateChanges() {
        const layers = this.remoteResource.archive.datasets.map(dataset => strRightBack(dataset, '/'));

        return RelatedResource.find({ 'remoteResource.location': this.options.remoteResourceLocation })
            .exec()
            .map(relatedResource => {
                if (relatedResource.get('remoteResource.available') !== this.remoteResource.available) {
                  relatedResource.set('remoteResource.available', this.remoteResource.available);
                }
                if (relatedResource.get('remoteResource.type') !== this.remoteResource.type) {
                  relatedResource.set('remoteResource.type', this.remoteResource.type);
                }
                if (!isEqual(relatedResource.get('remoteResource.layers'), layers)) {
                  relatedResource.set('remoteResource.layers', layers);
                }
                if (relatedResource.isModified()) {
                  return relatedResource
                    .set('updatedAt', this.now)
                    .save()
                    .then(() => RelatedResource.triggerConsolidation(relatedResource));
                } else {
                  return relatedResource;
                }
            });
    }

    exec() {
        return this.getRemoteResource()
            .then(() => this.checkResource())
            .then(checkResult => {
                if (this.checker.isArchive()) {
                    // Only handle if archive size < 100 MB
                    if (checkResult.headers['content-length'] && parseInt(checkResult.headers['content-length'], 10) > (100 * 1024 * 1024)) {
                        this.checker.closeConnection(true);
                        return this.archiveIsTooLarge();
                    } else {
                        return this.handleArchive();
                    }
                } else {
                    this.checker.closeConnection(true);
                    if (checkResult.fileExtension === 'ecw') {
                        this.remoteResource.set({ type: 'file-distribution', available: true });
                        return;
                    }
                    if (checkResult.fileExtension === 'csv') {
                        this.remoteResource.set({ type: 'file-distribution', available: true });
                        return;
                    }
                    this.remoteResource
                        .set('type', 'page') // Could be easily improved in the future
                        .set('available', undefined);
                }
            })
            .then(() => this.saveChanges())
            .then(() => this.propagateChanges())
            .return();
    }

}

module.exports = RemoteResourceCheck;
