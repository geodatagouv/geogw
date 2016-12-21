const request = require('superagent');
const Promise = require('bluebird');

const rootUrl = process.env.DATAGOUV_URL + '/api/1';
const apiKey = process.env.UDATA_PUBLICATION_USER_API_KEY;

function withApiKey(req) {
  return req.set('X-API-KEY', apiKey);
}

function withToken(req, token) {
  return req.set('Authorization', `Bearer ${token}`);
}

function getProfile(accessToken) {
    return Promise.resolve(
      withToken(request.get(rootUrl + '/me/'), accessToken)
        .then(resp => resp.body)
    );
}

function getOrganization(organizationId) {
  return Promise.resolve(
    request.get(`${rootUrl}/organizations/${organizationId}/`)
      .then(resp => resp.body)
  );
}

function addUserToOrganization(userId, organizationId, accessToken) {
  return Promise.resolve(
    withToken(request.post(`${rootUrl}/organizations/${organizationId}/member/${userId}`), accessToken)
      .send({ role: 'admin' })
      .catch(err => {
        if (err.status && err.status === 409) return; // User is already member
        throw err;
      })
  );
}

function removeUserFromOrganization(userId, organizationId, accessToken) {
  return Promise.resolve(
    withToken(request.del(`${rootUrl}/organizations/${organizationId}/member/${userId}`), accessToken)
      .set('content-length', 0)
    ).thenReturn();
}

function getUserRoleInOrganization(userId, organizationId) {
  return getOrganization(organizationId)
    .then(organization => {
      const membership = organization.members.find(membership => membership.user.id === userId);
      return membership ? membership.role : 'none';
    });
}

function deleteDatasetResource(datasetId, resourceId) {
  return Promise.resolve(
    withApiKey(request.del(rootUrl + '/datasets/' + datasetId + '/resources/' + resourceId + '/'))
    .set('content-length', 0)
  ).thenReturn();
}

function createDataset(dataset) {
  return Promise.resolve(
    withApiKey(request.post(rootUrl + '/datasets/'))
      .send(dataset)
      .then(resp => resp.body)
  );
}

function updateDataset(datasetId, dataset) {
  const updateOnly = Promise.resolve(
    withApiKey(request.put(rootUrl + '/datasets/' + datasetId + '/'))
      .send(dataset)
      .then(resp => resp.body)
  );
  if (dataset.resources.length > 0) {
    return updateOnly;
  } else {
    return updateOnly.then(publishedDataset => {
      return Promise.each(publishedDataset.resources, resource => deleteDatasetResource(datasetId, resource.id))
        .then(getDataset(datasetId));
    });
  }
}

function getDataset(datasetId) {
  return Promise.resolve(
    withApiKey(request.get(rootUrl + '/datasets/' + datasetId + '/'))
      .then(resp => resp.body)
  );
}

function deleteDataset(datasetId) {
  return Promise.resolve(
    withApiKey(request.del(rootUrl + '/datasets/' + datasetId + '/'))
    .set('content-length', 0)
  ).thenReturn();
}

function createDatasetTransferRequest(datasetId, recipientOrganizationId) {
  return Promise.resolve(
    withApiKey(request.post(rootUrl + '/transfer/'))
      .send({
        subject: { id: datasetId, class: 'DatasetFull' },
        recipient: { id: recipientOrganizationId, class: 'Organization' },
        comment: 'INSPIRE gateway automated transfer: request'
      })
      .then(resp => resp.body.id)
  );
}

function respondTransferRequest(transferId, response = 'accept') {
  return Promise.resolve(
    withApiKey(request.post(`${rootUrl}/transfer/${transferId}/`))
      .send({ comment: 'INSPIRE gateway automated transfer: response', response })
    ).thenReturn();
}

function transferDataset(datasetId, recipientOrganizationId) {
  return createDatasetTransferRequest(datasetId, recipientOrganizationId)
    .then(transferId => respondTransferRequest(transferId, 'accept'));
}

module.exports = { getOrganization, addUserToOrganization, removeUserFromOrganization, getProfile, createDataset, updateDataset, deleteDataset, getDataset, getUserRoleInOrganization, transferDataset };
