/*
** Module dependencies
*/
var users = require('../controllers/users');
var auth = require('./middlewares/auth');

module.exports = function(app) {

    app.route('/users')
        .all(auth.ensureLoggedIn)
        .get(users.list);

    app.route('/subscriptions/:serviceId')
        .all(auth.ensureLoggedIn)
        .put(users.subscribe)
        .delete(users.unsubscribe);

};
