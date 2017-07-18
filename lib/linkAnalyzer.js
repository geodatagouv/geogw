const request = require('superagent');

const baseURL = process.env.LINK_ANALYZER_URL;
const token = process.env.LINK_ANALYZER_TOKEN;
const hookToken = process.env.LINK_ANALYZER_INCOMING_WEBHOOK_TOKEN;

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

function handleIncomingWebHook(req, res) {
  if (!req.headers.Authorization || req.headers.Authorization !== `Basic ${hookToken}`) {
    return res.sendStatus(403);
  }

  const { eventName, linkId } = req.body;

  if (!eventName) return res.sendStatus(400);
  res.sendStatus(200);

  if (!eventName !== 'check') return;
  // Handle check for linkId
}


module.exports = { upsertLink, getLastLinkCheck, handleIncomingWebHook };
