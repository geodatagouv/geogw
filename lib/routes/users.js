/*
** Module dependencies
*/
var users = require('../controllers/users');
var auth = require('./middlewares/auth');

module.exports = function(app) {

    app.route('/profile').get(auth.ensureLoggedIn, users.showCurrentUser);

    app.route('/users')
        .all(auth.isAdmin)
        .get(users.list);

    app.route('/subscriptions/:serviceId')
        .all(auth.ensureLoggedIn)
        .put(users.subscribe)
        .delete(users.unsubscribe);

};
