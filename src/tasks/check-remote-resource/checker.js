import Plunger from 'plunger';
import fs from 'fs';
import { dir as tmpDir } from 'tmp';
import { exec } from 'child_process';
import Promise from 'bluebird';
import findit from 'findit';
import crypto from 'crypto';

const tmpDirAsync = Promise.promisify(tmpDir);
const execAsync = Promise.promisify(exec);


export default class Checker extends Plunger {

    constructor(location, options = {}) {
        super(location, options);
    }

    isArchive() {
        // RAR archive will be supported in the near future
        return this.archive === 'zip' && this.fileExtension === 'zip';
    }

    createTempDirectory() {
        return tmpDirAsync({ prefix: 'plunger_', unsafeCleanup: true, keep: true })
            .then(tmpDirResult => {
                this.tempDirectoryPath = tmpDirResult[0];
                this.cleanupCallback = tmpDirResult[1];
                return this.tempDirectoryPath;
            });
    }

    saveArchive() {
        return this.createTempDirectory()
            .then(path => {
                return new Promise((resolve, reject) => {
                    this.archivePath = path + '/archive.' + this.archive;

                    let hash = crypto.createHash('sha1');

                    this
                        .pipeWithResponse(hash)
                        .on('finish', () => this.digest = hash.read());

                    this
                        .pipeWithResponse(fs.createWriteStream(this.archivePath))
                        .on('finish', () => resolve(this.archivePath))
                        .on('error', reject);
                });
            });
    }

    decompressArchive() {
        if (this.decompressedDirectoryPath) return Promise.resolve(this.decompressedDirectoryPath);
        if (!this.archivePath) return Promise.reject(new Error('`archivePath` is not defined'));
        let decompressProcess;
        if (this.archive === 'zip') decompressProcess = execAsync('unzip -d decompressed archive.zip', { cwd: this.tempDirectoryPath });
        if (this.archive === 'rar') decompressProcess = execAsync('unrar x archive.rar decompressed/', { cwd: this.tempDirectoryPath });
        if (decompressProcess) {
            return decompressProcess.then(() => {
                this.decompressedDirectoryPath = this.tempDirectoryPath + '/decompressed';
                return this.decompressedDirectoryPath;
            });
        } else {
            return Promise.reject('Archive type not supported: ' + this.archive);
        }
    }

    listFiles() {
        if (!this.decompressedDirectoryPath) return Promise.reject(new Error('No iterable path found'));
        const startPoint = this.decompressedDirectoryPath.length + 1;
        const paths = [];
        const datasets = [];
        return new Promise((resolve, reject) => {
            findit(this.decompressedDirectoryPath)
                .on('file', file => {
                    let shortFileName = file.substring(startPoint);
                    paths.push(shortFileName);
                    if (shortFileName.match(/\.(shp|tab|mif)$/i)) datasets.push(shortFileName);
                })
                .on('end', () => resolve({ all: paths, datasets: datasets }))
                .on('error', reject);
        });
    }

    cleanup() {
        if (this.cleanupCallback) {
            this.cleanupCallback();
            this.cleanupCallback = null;
        }
    }

}
