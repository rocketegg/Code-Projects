'use strict';

// Notifications routes use notifications controller
var notifications = require('../controllers/notifications');
var authorization = require('./middlewares/authorization');

// Notification authorization helpers
var hasAuthorization = function(req, res, next) {
    //should be TO:[] or FROM:[] contains user or user is the creator
    if (req.notification.user.id !== req.user.id) {
        return res.send(401, 'User is not authorized');
    }
    next();
};

var canSee = function(req, res, next) {
    //should be TO:[] or FROM:[] contains user or user is the creator
    if (req.notification.to.indexOf(req.user._id) > -1) {
        return res.send(401, 'User is not authorized');
    }
    next();
};

module.exports = function(app) {
    app.get('/notifications/sent', notifications.allsent);
    app.get('/notifications', notifications.all);
    app.post('/notifications/:notificationId/markasread', authorization.requiresLogin, canSee, notifications.markAsRead);

    app.post('/notifications', authorization.requiresLogin, notifications.create);
    app.get('/notifications/:notificationId', notifications.show);
    //app.put('/notifications/:notificationId', authorization.requiresLogin, hasAuthorization, notifications.update);
    app.del('/notifications/:notificationId', authorization.requiresLogin, hasAuthorization, notifications.destroy);

    // Finish with setting up the notificationId param
    app.param('notificationId', notifications.notification);

};