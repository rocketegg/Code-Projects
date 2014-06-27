'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Article = mongoose.model('Article'),
    _ = require('lodash'),
    temp = require('temp'),
    fs = require('fs'),
    officegen = require('officegen');


/**
 * Find article by id
 */
exports.article = function(req, res, next, id) {
    Article.load(id, function(err, article) {
        if (err) return next(err);
        if (!article) return next(new Error('Failed to load article ' + id));
        req.article = article;
        next();
    });
};

/**
 * Create an article
 */
exports.create = function(req, res) {
    var article = new Article(req.body);
    article.user = req.user;

    article.save(function(err) {
        if (err) {
            return res.send('users/signup', {
                errors: err.errors,
                article: article
            });
        } else {
            res.jsonp(article);
        }
    });
};

/**
 * Update an article
 */
exports.update = function(req, res) {
    var article = req.article;

    article = _.extend(article, req.body);

    article.save(function(err) {
        if (err) {
            return res.send('users/signup', {
                errors: err.errors,
                article: article
            });
        } else {
            res.jsonp(article);
        }
    });
};

/**
 * Delete an article
 */
exports.destroy = function(req, res) {
    var article = req.article;

    article.remove(function(err) {
        if (err) {
            return res.send('users/signup', {
                errors: err.errors,
                article: article
            });
        } else {
            res.jsonp(article);
        }
    });
};

function _file(article, type, options, callback) {
    var string = '';
    var out = temp.createWriteStream();
    var docx = officegen ({
        'type': 'docx',
        'onend': function(written) {
            console.log ( 'Finished creating a word file.\nTotal bytes created: ' + written + '\n' );
        },
        'onerr': function(err) {
            console.log(err);
        }
    });

    out.on('finish', function() {
        callback(out.path); 
        //NOTE: bug with officegen - we can only call res.download after
        //the stream is completely done - not when onend is hit
    });

    var pObj = docx.createP();
    pObj.addText ( article.title, { bold: true } );
    pObj.addLineBreak();
    pObj.addLineBreak();
    _prepareForWord(article.content, pObj);
    docx.generate(out);
}

exports.export = function(req, res) {
    var article = req.article;
    var format = 'docx';

    _file(article, format, {details:true}, function(content) {
        res.download(content, filename);
    });
}

/**
 * Show an article
 */
exports.show = function(req, res) {
    res.jsonp(req.article);
};

/**
 * List of Articles
 */
exports.all = function(req, res) {
    Article.find().sort('-created').populate('user', 'name username').exec(function(err, articles) {
        if (err) {
            res.render('error', {
                status: 500
            });
        } else {
            res.jsonp(articles);
        }
    });
};
