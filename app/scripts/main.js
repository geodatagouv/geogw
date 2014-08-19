// Setup moment locale
require('moment/lang/fr');

var app = angular.module('mainApp', ['ngRoute']);

app.filter('duration', require('./filters/duration'));
app.filter('timeago', require('./filters/timeago'));
app.filter('prune', require('./filters/prune'));

app.config(require('./routes'));

app.controller('ServicesCtrl', require('./controllers/services'));
app.controller('ServiceDatasetsCtrl', require('./controllers/serviceDatasets'));
app.controller('DatasetCtrl', require('./controllers/dataset'));
