'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

/**
 * Notification Schema
 * - can be sent to one or many people, from one or many persons
 * - has some content
 * - has a type (e.g. friendrequest, newversion, update)
 * - these will be used to backfill emails and will show up in the UI for a given user
 */
var NotificationSchema = new Schema({
    created: {
        type: Date,
        default: Date.now
    },
    //the creator
    user: {
        type: Schema.ObjectId,
        ref: 'User'
    },
    subject: {
        type: String,
        default: '',
        trim: true
    },
    content: {
        type: String,
        default: '',
        trim: true
    },
    //list of senders
    from: [{
        type: Schema.ObjectId,
        ref: 'User'
    }],
    //list of recipients
    to: [{
        type: Schema.ObjectId,
        ref: 'User'
    }],
    //list of users who have seen the notification, if a user has seen the notification, it'll get greyed out
    seen: [{
        type: Schema.ObjectId,
        ref: 'User'
    }],
    type: {
        type: String,
        default: 'general',
        trim: true
    }
});

/**
 * Validations
 */
NotificationSchema.path('subject').validate(function(subject) {
    return subject.length;
}, 'Subject cannot be blank');

//Middleware

NotificationSchema.post('remove', function (doc) {
    //what should happen when a notification is removed
    //can probably have a process to backfill notifications
});

/**
 * Statics
 */
NotificationSchema.statics.load = function(id, cb) {
    console.log('[Notifications] Loading notification id: %s', id);
    this.findOne({
        _id: id
    }).populate('from', 'name username').populate('to', 'name username').exec(cb);
};

NotificationSchema.statics.loadFromUser = function(userId, cb) {
    console.log('[Notifications] Loading notification from user: %s', userId);
    this.find({
        from: userId
    }).populate('from', 'name username').populate('to', 'name username').exec(cb);
};

NotificationSchema.statics.loadToUser = function(userId, cb) {
    console.log('[Notifications] Loading notification to user: %s', userId);
    this.find({
        to: userId
    }).populate('from', 'name username').populate('to', 'name username').exec(cb);
};

NotificationSchema.statics.markAsRead = function(userId, notificationId, cb) {
    console.log('[Notifications] Marking notification %sas read by user: %s', notificationId, userId);
    this.findOne({
        _id: notificationId
    }, function(err, notification) {
        if (err) throw err;
        notification.seen.addToSet(userId);
        notification.save(cb)
    });
};



mongoose.model('Notification', NotificationSchema);
