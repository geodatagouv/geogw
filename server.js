var express = require('express');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var passport = require('./server/passport');
var api = require('./server/api');
var redis = require('./server/redis');
var RedisStore = require('connect-redis')(session);

var app = express();

app.set('view engine', 'jade');
app.set('views', __dirname + '/views');

app.use(express.static('app'));
app.use(cookieParser());

app.use(session({
    store: new RedisStore({ client: redis.createClient() }),
    secret: process.env.COOKIE_SECRET,
    name: 'sid'
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(api);

app.get('/auth/datagouv', passport.authenticate('datagouv'));
app.get('/auth/datagouv/callback', passport.authenticate('datagouv', { 
    successRedirect: '/',
    failureRedirect: '/login'
}));

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.get('/', function(req, res) {
    if (!req.user) res.redirect('/auth/datagouv');
    res.render('index');
});

app.listen(process.env.PORT);
