var express = require('express');
var cookieParser = require('cookie-parser');
var session = require('express-session');
require('./server/mongoose'); // Must be called before passport. FIXME
var passport = require('./server/passport');
var api = require('./server/api');
var redis = require('./server/redis');
var RedisStore = require('connect-redis')(session);
var morgan = require('morgan');

var app = express();

if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', true);
    app.use(morgan(':req[x-real-ip] - - [:date] ":method :url HTTP/:http-version" :status - :response-time ms - :res[content-length] ":referrer"'));
} else {
    app.use(morgan('dev'));
}

app.use(express.static('.tmp'));
app.use(express.static('app'));
app.use(cookieParser());

app.use(session({
    store: new RedisStore({ client: redis.createClient() }),
    secret: process.env.COOKIE_SECRET,
    name: 'sid'
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/api', api);

app.get('/auth/datagouv', passport.authenticate('datagouv'));
app.get('/auth/datagouv/callback', passport.authenticate('datagouv', { 
    successRedirect: '/',
    failureRedirect: '/login'
}));

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.get('*', function(req, res) {
    res.sendFile(__dirname + '/app/index.html');
});

app.listen(process.env.PORT);
