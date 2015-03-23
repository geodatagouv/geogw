var express = require('express');
require('./server/mongoose');
var api = require('./server/api');
var morgan = require('morgan');
var httpProxy = require('http-proxy');

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

app.get('*', function(req, res) {
    res.sendFile(__dirname + '/app/index.html');
});

app.listen(process.env.PORT);
