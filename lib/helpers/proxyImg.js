'use strict';

const request = require('request');
const fileType = require('file-type');
const fs = require('fs');
const fresh = require('fresh');
const { pick } = require('lodash');

const unavailableThumbnail = fs.readFileSync(__dirname + '/../../france/img/unavailable-thumbnail.png');

function sendReplacementImage(res) {
  res.set('Content-Type', 'image/png').send(unavailableThumbnail);
}

function notModified(res) {
  res.status(304).end();
}

const ACCEPTED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
];

function proxyImg(url, req, res) {
  request(url, { encoding: null })
    .on('error', () => sendReplacementImage(res))
    .on('response', response => {

      function stopAndSendReplacementImage() {
        response.destroy();
        sendReplacementImage(res);
      }

      if (response.statusCode !== 200) {
        stopAndSendReplacementImage();
      }

      const timeout = setTimeout(stopAndSendReplacementImage, 10000);

      response.once('data', chunk => {
        clearTimeout(timeout);
        const type = fileType(chunk);
        if (!ACCEPTED_MIME_TYPES.includes(type.mime)) {
          response.destroy();
          sendReplacementImage(res);
        } else if (fresh(req.headers, pick(response.headers, 'etag', 'last-modified'))) {
          response.destroy();
          notModified(res);
        } else {
          res.set('Content-Type', type.mime);
          if (response.headers['content-length']) {
            res.set('Content-Length', response.headers['content-length']);
          }
          if (response.headers['etag']) {
            res.set('ETag', response.headers['etag']);
          }
          if (response.headers['last-modified']) {
            res.set('Last-Modified', response.headers['last-modified']);
          }
          res.write(chunk);
          response.pipe(res);
        }
      });
    });
}

module.exports = proxyImg;
