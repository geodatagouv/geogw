const request = require('superagent');

const baseURL = process.env.LINK_ANALYZER_URL;
const token = process.env.LINK_ANALYZER_TOKEN;

function upsertLink(location) {
  request.post(baseURL + '/api/links')
    .set('Authorization', 'Basic ' + token)
    .send({ location })
    .then(res => res.body);
}

function getLastLinkCheck(linkId) {
  request.get(baseURL + '/api/links/' + linkId + '/checks/last')
    .then(res => res.body);
}

module.exports = { upsertLink, getLastLinkCheck };
