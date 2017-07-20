'use strict';

const request = require('superagent');
const sidekick = require('./helpers/sidekick');

const baseURL = process.env.LINK_ANALYZER_URL;
const token = process.env.LINK_ANALYZER_TOKEN;
const hookToken = process.env.LINK_ANALYZER_INCOMING_WEBHOOK_TOKEN;

function upsertLink(location) {
  return request.post(baseURL + '/api/links')
    .set('Authorization', 'Basic ' + token)
    .send({ location })
    .then(res => res.body);
}

function getLastLinkCheck(linkId) {
  return request.get(baseURL + '/api/links/' + linkId + '/checks/last')
    .then(res => res.body);
}

function handleIncomingWebHook(req, res) {
  if (!req.headers.authorization || req.headers.authorization !== `Basic ${hookToken}`) {
    return res.sendStatus(403);
  }

  const { eventName, linkId } = req.body;

  if (!eventName) return res.sendStatus(400);
  if (eventName !== 'check') return res.sendStatus(200);

  sidekick('geogw:incoming-webhook:link-analyzer', { eventName, linkId })
    .then(() => res.sendStatus(200))
    .catch(err => {
      console.error(err);
      res.sendStatus(500);
    });
}


module.exports = { upsertLink, getLastLinkCheck, handleIncomingWebHook };
