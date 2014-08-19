module.exports = function($scope, SessionService) {
    $scope.isLoggedIn = SessionService.isLoggedIn();

    $scope.$on('userLoggedIn', function() {
        $scope.isLoggedIn = true;
    });
};
