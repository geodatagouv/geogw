'use strict';

exports.isMaintenance = function (req, res, next) {
  if (req.query.token && process.env.MAINTENANCE_TOKEN && req.query.token === process.env.MAINTENANCE_TOKEN)
    return next();
  res.sendStatus(401);
};

exports.authenticateClient = function (req, res, next) {
  let clients;
  try {
    clients = require('../../../clients.json');
  } catch (err) {
    clients = [];
  }
  const token = req.headers.authorization ? req.headers.authorization.substr(6) : req.query.token;
  if (!token) return next();
  req.apiClient = clients.find(client => client.token === token);
  if (!req.apiClient) return res.sendStatus(401);
  next();
};

exports.authenticatedClient = function (req, res, next) {
  if (!req.apiClient) return res.sendStatus(401);
  next();
};

exports.clientHasScope = function (scope) {
  return function (req, res, next) {
    if (!req.apiClient) return res.sendStatus(401);
    if (!req.apiClient.scopes.includes(scope)) res.sendStatus(403);
    next();
  };
};
