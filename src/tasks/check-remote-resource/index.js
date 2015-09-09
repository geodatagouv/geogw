import mongoose from 'mongoose';
import Promise from 'bluebird';
import Plunger from '../../helpers/plunger';
import strRightBack from 'underscore.string/strRightBack';
import omit from 'lodash/object/omit';

const RemoteResource = mongoose.model('RemoteResource');
const RelatedResource = mongoose.model('RelatedResource');


export default class RemoteResourceCheck {

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
            });
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

                this.remoteResource
                    .set('available', true)
                    .set('type', files.datasets.length > 0 ? 'file-distribution' : 'unknown-archive');
            })
            .catch(err => {
                if (err.message === 'Archive is too large') {
                    this.remoteResource
                        .set('checkResult.archiveTooLarge', true)
                        .set('available', true)
                        .set('type', 'unknown-archive');
                } else {
                    return Promise.reject(err);
                }
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
                if (relatedResource.remoteResource.available === this.remoteResource.available &&
                    relatedResource.remoteResource.type === this.remoteResource.type) {
                    return Promise.resolve();
                }

                return relatedResource
                    .set('remoteResource.available', this.remoteResource.available)
                    .set('remoteResource.type', this.remoteResource.type)
                    .set('remoteResource.layers', layers)
                    .set('updatedAt', this.now)
                    .save()
                    .then(() => RelatedResource.triggerConsolidation(relatedResource));
            });
    }

    exec() {
        return this.getRemoteResource()
            .then(() => this.checkResource())
            .then(() => {
                if (this.checker.isArchive()) {
                    return this.handleArchive();
                } else {
                    this.checker.closeConnection(true);
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
