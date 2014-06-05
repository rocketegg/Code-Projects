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

//Only FRs and CRs are deletable (general messages are not so users can continue to see them)
var isDeleteable = function(req, res, next) {
    if (req.notification.type == 'friendrequest' || req.notification.type == 'collabrequest') {
        next();
    } else {
        return res.send(200);
    }
}

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
    app.post('/notifications/friendrequest/:notificationId/accept', authorization.requiresLogin, canSee, notifications.acceptFriendRequest);
    app.post('/notifications/friendrequest/:notificationId/reject', authorization.requiresLogin, canSee, notifications.rejectFriendRequest);
    app.post('/notifications/collabrequest/:notificationId/accept', authorization.requiresLogin, canSee, notifications.acceptCollabRequest);
    app.post('/notifications/collabrequest/:notificationId/reject', authorization.requiresLogin, canSee, notifications.rejectCollabRequest);
    app.post('/notifications/friendrequest', authorization.requiresLogin, notifications.createFriendRequest);
    app.post('/notifications/collabrequest', authorization.requiresLogin, notifications.createCollabRequest);

    app.post('/notifications', authorization.requiresLogin, notifications.create);
    app.get('/notifications/:notificationId', notifications.show);
    //app.put('/notifications/:notificationId', authorization.requiresLogin, hasAuthorization, notifications.update);
    app.del('/notifications/:notificationId', authorization.requiresLogin, hasAuthorization, isDeleteable, notifications.destroy);

    // Finish with setting up the notificationId param
    app.param('notificationId', notifications.notification);

    app.get('/users', notifications.getusers);

};