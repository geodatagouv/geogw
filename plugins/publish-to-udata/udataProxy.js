'use strict';

const express = require('express');
const request = require('superagent');

const rootUrl = process.env.DATAGOUV_URL + '/api';

const ALLOWED_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'];

module.exports = function () {

  const router = express.Router({ strict: true });

  router.all('*', function (req, res, next) {
    if (!ALLOWED_METHODS.includes(req.method)) return res.sendStatus(405);
    const method = req.method.toLowerCase();
    const url = rootUrl + req.path;
    const proxyReq = request[method](url).query(req.query);
    if (req.user) {
      proxyReq.set('Authorization', 'Bearer ' + req.user.accessToken);
    }
    if (req.body) {
      proxyReq.send(req.body);
    }
    proxyReq.end(function (err, proxyRes) {
      if (err && !err.status) return next(err);
      if (err && err.status) {
        proxyRes = err.response;
      }
      res.status(proxyRes.status);
      if (proxyRes.body) {
        res.send(proxyRes.body);
      } else {
        res.end();
      }
    });
  });

  return router;

};
