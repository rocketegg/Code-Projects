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
