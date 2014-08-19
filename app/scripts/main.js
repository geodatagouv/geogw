// Setup moment locale
require('moment/lang/fr');

var mainApp = angular.module('mainApp', ['ngRoute']);

mainApp.filter('duration', require('./filters/duration'));
mainApp.filter('timeago', require('./filters/timeago'));
mainApp.filter('prune', require('./filters/prune'));

mainApp.config(require('./routes'));

mainApp.controller('ServicesCtrl', require('./controllers/services'));
mainApp.controller('ServiceDatasetsCtrl', require('./controllers/serviceDatasets'));
mainApp.controller('DatasetCtrl', require('./controllers/dataset'));
