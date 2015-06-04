var express = require('express');
require('./lib/mongoose');
var api = require('./lib/api');
var morgan = require('morgan');

var app = express();

if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', true);
    app.use(morgan(':req[x-real-ip] - - [:date] ":method :url HTTP/:http-version" :status - :response-time ms - :res[content-length] ":referrer"'));
} else {
    app.use(morgan('dev'));
}

app.use('/api', api);

app.listen(process.env.PORT);
