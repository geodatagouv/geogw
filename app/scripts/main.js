// Setup moment locale
require('moment/locale/fr');

var app = angular.module('mainApp', ['ngRoute']);

// Register filters
app.filter('duration', require('./filters/duration'));
app.filter('timeago', require('./filters/timeago'));
app.filter('prune', require('./filters/prune'));

app.config(require('./routes'));

// Register services
app.factory('SessionService', require('./services/session'));

// Register controllers
app.controller('ServicesCtrl', require('./controllers/services'));
app.controller('ServiceDatasetsCtrl', require('./controllers/serviceDatasets'));
app.controller('DatasetCtrl', require('./controllers/dataset'));

app.run(function($rootScope, $location, $window, SessionService) {
    $rootScope.$on('$routeChangeSuccess', function () {
        if (!$window.ga) return;
        $window.ga('send', 'pageview', { page: $location.path() });
    });

    SessionService.init();
    SessionService.fetch();
});
