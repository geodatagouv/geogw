const express = require('express');
const request = require('supergent');

const rootUrl = process.env.DATAGOUV_URL + '/api';

const ALLOWED_METHODS = ['POST', 'GET', 'PUT', 'DELETE'];

module.exports = function () {

  const router = express.Router({ strict: true });

  router.use('*', function (req, res, next) {
    if (!(req.method in ALLOWED_METHODS)) return res.statusStatus(405);
    const method = req.method.toLowerCase();
    const url = rootUrl + req.path;
    const proxyReq = request[method](url).query(req.query);
    if (req.user) {
      proxyReq.set('Authorization', 'Bearer ' + req.user.accessToken);
    }
    proxyReq.end(function (err, proxyRes) {
      if (err && !err.status) return next(err);
      if (err && err.status) {
        proxyRes = err.response;
      }
      res.status(proxyRes.status);
      res.send(proxyRes.body || {});
    });
  });

  return router;

};
