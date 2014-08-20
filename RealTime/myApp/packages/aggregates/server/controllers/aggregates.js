'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    _ = require('lodash');


/**
 * Find aggregate by id
 */
exports.aggregate = function(req, res, next, id) {
    var Aggregate = mongoose.model('Aggregate');
    Aggregate.load(id, function(err, aggregate) {
        if (err) return next(err);
        if (!aggregate) return next(new Error('Failed to load aggregate ' + id));
        req.aggregate = aggregate;
        next();
    });
};

/**
 * Create an aggregate
 */
exports.create = function(req, res) {
    var Aggregate = mongoose.model('Aggregate');
    var aggregate = new Aggregate(req.body);

    aggregate.save(function(err) {
        if (err) {
            return res.send('users/signup', {
                errors: err.errors,
                aggregate: aggregate
            });
        } else {
            res.jsonp(aggregate);
        }
    });
};

/**
 * Update an aggregate
 */
exports.update = function(req, res) {
    var aggregate = req.aggregate;

    aggregate = _.extend(aggregate, req.body);

    aggregate.save(function(err) {
        if (err) {
            return res.send('users/signup', {
                errors: err.errors,
                aggregate: aggregate
            });
        } else {
            res.jsonp(aggregate);
        }
    });
};

/**
 * Delete an aggregate
 */
exports.destroy = function(req, res) {
    var aggregate = req.aggregate;

    aggregate.remove(function(err) {
        if (err) {
            return res.send('users/signup', {
                errors: err.errors,
                aggregate: aggregate
            });
        } else {
            res.jsonp(aggregate);
        }
    });
};

/**
 * Show an aggregate
 */
exports.show = function(req, res) {
    res.jsonp(req.aggregate);
};

/**
 * List of Aggregates
 */
exports.all = function(req, res) {
    var Aggregate = mongoose.model('Aggregate');
    Aggregate.find().sort({'metadata.lastRun': 1}).exec(function(err, aggregates) {
        if (err) {
            res.render('error', {
                status: 500
            });
        } else {
            res.jsonp(aggregates);
        }
    });
};
