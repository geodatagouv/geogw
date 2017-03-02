const request = require('request');
const fileType = require('file-type');
const fs = require('fs');

const unavailableThumbnail = fs.readFileSync(__dirname + '/../../france/img/unavailable-thumbnail.png');

function sendReplacementImage(res) {
  res.set('Content-Type', 'image/png').send(unavailableThumbnail);
}

const ACCEPTED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
];

function proxyImg(url, res) {
  request(url, { encoding: null })
    .on('error', () => sendReplacementImage(res))
    .on('response', response => {
      response.once('data', chunk => {
        const type = fileType(chunk);
        if (!ACCEPTED_MIME_TYPES.includes(type.mime)) {
          response.destroy();
          sendReplacementImage(res);
        } else {
          res.set('Content-Type', type.mime);
          if (response.headers['content-length']) {
            res.set('Content-Length', response.headers['content-length']);
          }
          res.write(chunk);
          response.pipe(res);
        }
      });
    });
}

module.exports = proxyImg;
