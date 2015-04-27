var express = require('express');
var mongoose = require('./server/mongoose');
var api = require('./server/api');
var morgan = require('morgan');
var httpProxy = require('http-proxy');

var Record = mongoose.model('Record');

var app = express();
var proxy = httpProxy.createProxyServer({ changeOrigin: true });

if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', true);
    app.use(morgan(':req[x-real-ip] - - [:date] ":method :url HTTP/:http-version" :status - :response-time ms - :res[content-length] ":referrer"'));
} else {
    app.use(morgan('dev'));
}

app.use(express.static('.tmp'));
app.use(express.static('app'));

if (process.env.API_URL) {
    app.use('/api', function (req, res) {
        proxy.web(req, res, { target: process.env.API_URL });
    });
} else {
    app.use('/api', api);
}

function showPage(req, res) {
    res.sendFile(__dirname + '/app/index.html');
}

// Legacy URL
app.get('/services/:serviceId/datasets/:datasetId', function (req, res, next) {
    if (req.params.datasetId.length !== 24) return next();
    Record
        .findById(req.params.datasetId)
        .select('hashedId')
        .exec(function (err, record) {
            if (err) return next(err);
            if (!record || !record.hashedId) return res.sendStatus(404);
            res.redirect(301, '/services/' + req.params.serviceId + '/datasets/' + record.hashedId);
        });
});

app.get('*', showPage);

app.listen(process.env.PORT);
