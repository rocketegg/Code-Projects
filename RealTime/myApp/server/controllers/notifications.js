'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Notification = mongoose.model('Notification'),
    _ = require('lodash'),
    async = require('async');


/**
 * Find notification by id
 */
exports.notification = function(req, res, next, id) {
    Notification.load(id, function(err, notification) {
        if (err) return next(err);
        if (!notification) return next(new Error('Failed to load notification ' + id));
        req.notification = notification;
        next();
    });
};

/**
 * Create an notification
 */
exports.create = function(req, res) {
    var notification = new Notification(req.body);
    notification.user = req.user;
    notification.from = [];
    notification.from.push(req.user);

    notification.save(function(err, notification) {
        if (err) {
            console.log(err);
            return res.send('users/signup', {
                errors: err.errors,
                notification: notification
            });
        } else {
            res.jsonp(notification);
        }
    });
};

/**
 * Create an notification
 */
exports.createFriendRequest = function(req, res) {
    var notification = new Notification(req.body);
    notification.user = req.user;
    notification.from = [];
    notification.from.push(req.user);
    notification.type = 'friendrequest';

    notification.save(function(err, notification) {
        if (err) {
            console.log(err);
            return res.send('users/signup', {
                errors: err.errors,
                notification: notification
            });
        } else {
            res.jsonp(notification);
        }
    });
};

/**
 * Create an notification
 */
exports.createCollabRequest = function(req, res) {
    var notification = new Notification(req.body);
    notification.user = req.user;
    notification.from = [];
    notification.from.push(req.user);
    notification.type = 'collabrequest';

    notification.save(function(err, notification) {
        if (err) {
            console.log(err);
            return res.send('users/signup', {
                errors: err.errors,
                notification: notification
            });
        } else {
            res.jsonp(notification);
        }
    });
};

exports.acceptFriendRequest = function(req, res) {
    var notification = req.notification;
    var user = req.user;
    var sender = notification.from[0];

    //1 remove notification
    //2 add user to friends
    //3 send notification to sender
    var reply = new Notification();
    reply.subject = 'Your FR was accepted by ' + user.username + '.';
    reply.from = user;
    reply.to = sender;
    reply.user = user;

    async.parallel([
        function(callback) {
            console.log('[NOTIFICATIONS]: FR was accepted. Deleting notification %s', notification._id);
            notification.remove(callback);
        },

        function(callback) {
            //
            console.log('[NOTIFICATIONS]: Adding user %s to friends list of user %s', user._id, sender._id);
            callback();
        },

        function(callback) {
            console.log('[NOTIFICATIONS]: FR was accepted. Sending reply notification %s', reply._id);
            reply.save(callback);
        }

    ], function(err, results) {
        if (err) throw err;
        res.jsonp(results);
    });
};

exports.rejectFriendRequest = function(req, res) {
    var notification = req.notification;
    var user = req.user;
    var sender = notification.from[0];

    //1 remove notification
    //2 send notification to sender
    var reply = new Notification();
    reply.subject = 'Your FR was rejected by ' + user.username + '.';
    reply.from = user;
    reply.to = sender;
    reply.user = user;

    async.parallel([
        function(callback) {
            console.log('[NOTIFICATIONS]: FR was rejected. Deleting notification %s', notification._id);
            notification.remove(callback);
        },

        //do nothing

        function(callback) {
            console.log('[NOTIFICATIONS]: FR was rejected. Sending reply notification %s', reply._id);
            reply.save(callback);
        }

    ], function(err, results) {
        if (err) throw err;
        res.jsonp(results);
    });
};

exports.acceptCollabRequest = function(req, res) {
    var notification = req.notification;
    var user = req.user;
    var sender = notification.from[0];
    var recipients = notification.to;

    var userIndex = notification.to.map(function(users) { return users._id}).indexOf(user._id);
    notification.to.splice(userIndex, 1);

    //1 remove notification
    //2 add user to friends
    //3 send notification to sender
    var reply = new Notification();
    reply.subject = 'Your CR was accepted by ' + user.username + '.';
    reply.from = user;
    reply.to = sender;
    reply.user = user;

    async.parallel([
        function(callback) {
            console.log('[NOTIFICATIONS]: CR was accepted. Removing user %s from notification recipients %s', user._id, notification._id);
            if (notification.to.length === 0) {
                console.log('[NOTIFICATIONS]: No more recipients, removing notification %s', notification._id);
                notification.remove(callback);
            } else {
                console.log('[NOTIFICATIONS]: Still at least 1 recipient.  Saving notification %s', notification._id);
                notification.save(callback);
            }

        },

        function(callback) {
            //add user to collabs
            console.log('[NOTIFICATIONS]: Adding user %s to collabs list of j %s', user._id, sender._id);
            callback();
        },

        function(callback) {
            console.log('[NOTIFICATIONS]: CR was accepted. Sending reply notification %s', reply._id);
            reply.save(callback);
        }

    ], function(err, results) {
        if (err) {
            return res.send('users/signup', {
                errors: err.errors,
                notification: notification
            });
        }
        res.jsonp(results);
    });
};

exports.rejectCollabRequest = function(req, res) {
var notification = req.notification;
    var user = req.user;
    var sender = notification.from[0];
    var recipients = notification.to;

    var userIndex = notification.to.map(function(users) { return users._id}).indexOf(user._id);
    notification.to.splice(userIndex, 1);

    //1 remove notification
    //2 add user to friends
    //3 send notification to sender
    var reply = new Notification();
    reply.subject = 'Your CR was rejected by ' + user.username + '.';
    reply.from = user;
    reply.to = sender;
    reply.user = user;

    async.parallel([
        function(callback) {
            console.log('[NOTIFICATIONS]: CR was rejected. Removing user %s from notification recipients %s', user._id, notification._id);
            if (notification.to.length === 0) {
                console.log('[NOTIFICATIONS]: No more recipients, removing notification %s', notification._id);
                notification.remove(callback);
            } else {
                console.log('[NOTIFICATIONS]: Still at least 1 recipient.  Saving notification %s', notification._id);
                notification.save(callback);
            }

        },

        function(callback) {
            console.log('[NOTIFICATIONS]: CR was rejected. Sending reply notification %s', reply._id);
            reply.save(callback);
        }

    ], function(err, results) {
        if (err) {
            return res.send('users/signup', {
                errors: err.errors,
                notification: notification
            });
        }
        res.jsonp(results);
    });
};

exports.getusers = function(req, res) {
    var User = mongoose.model('User');

    User.find().exec(function(err, users) {
        if (err) throw err;
        res.jsonp(users);
    });
};

/**
 * Update an notification
 */
// exports.update = function(req, res) {
//     var oldNotification = req.notification;

//     console.log(req.body);
//     var newNotification = new Notification();
//     newNotification.series = oldNotification.series;
//     newNotification.title = req.body.title;
//     newNotification.content = req.body.content;
//     newNotification.user = req.user;

//     Notification.newversion(oldNotification, newNotification, function(err, notification) {
//         if (err) {
//             return res.send('users/signup', {
//                 errors: err.errors,
//                 notification: notification
//             });
//         } else {
//             res.jsonp(notification);
//         }
//     });
// };

/**
 * Mark as Read
 */

 exports.markAsRead = function(req, res) {
    var notification = req.notification;
    var hasSeen = notification.seen.indexOf(req.user._id) > -1 ? true : false;

    if (!hasSeen) {
        console.log('[NOTIFICATION] Marking notification as seen by user %s', req.user._id);
        Notification.markAsRead(req.user._id, notification._id, function(err, updated) {
            if (err) {
                res.render('error', {
                    status: 500
                });
            } else {
                res.jsonp(updated);
            }
        });
    } else {
        //already seen
        console.log('[NOTIFICATION] Notification already seen by user %s', req.user._id);
        res.send(200, notification);
    }
 };

/**
 * Delete an notification
 */
exports.destroy = function(req, res) {
    var notification = req.notification;

    notification.remove(function(err) {
        if (err) {
            return res.send('users/signup', {
                errors: err.errors,
                notification: notification
            });
        } else {
            res.jsonp(notification);
        }
    });
};

/**
 * Show an notification
 */
exports.show = function(req, res) {
    res.jsonp(req.notification);
};

/**
 * List of Notifications
 */
exports.all = function(req, res) {
    Notification.loadToUser(req.user._id, function(err, notifications) {
        if (err) {
            res.render('error', {
                status: 500
            });
        } else {
            res.jsonp(notifications);
        }
    });
};

exports.allsent = function(req, res) {
    Notification.loadFromUser(req.user._id, function(err, notifications) {
        if (err) {
            res.render('error', {
                status: 500
            });
        } else {
            res.jsonp(notifications);
        }
    });
};
