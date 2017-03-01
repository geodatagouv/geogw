const request = require('superagent');
const Promise = require('bluebird');

const ROOT_URL = process.env.GEOGW_URL + '/api/geogw';
const TOKEN = process.env.GEOGW_TOKEN;
const TARGET = process.env.GEOGW_PUBLICATION_TARGET;

function recordUrl(recordId) {
  return `${ROOT_URL}/records/${recordId}`;
}

function publicationUrl(recordId) {
  return `${recordUrl(recordId)}/publications/${TARGET}`;
}

exports.getRecord = function (recordId) {
  return Promise.resolve(
    request.get(recordUrl(recordId))
      .then(res => res.body)
  );
};

exports.setRecordPublication = function (recordId, publicationInfo) {
  return Promise.resolve(
    request.put(publicationUrl(recordId))
      .set('Authorization', `Basic ${TOKEN}`)
      .send(publicationInfo)
      .then(res => res.body)
  );
};

exports.unsetRecordPublication = function (recordId) {
  return Promise.resolve(
    request.del(publicationUrl(recordId))
      .set('Authorization', `Basic ${TOKEN}`)
  ).thenReturn();
};

exports.getPublications = function () {
  return Promise.resolve(
    request.get(`${ROOT_URL}/publications/${TARGET}`)
      .then(res => res.body)
  );
};
