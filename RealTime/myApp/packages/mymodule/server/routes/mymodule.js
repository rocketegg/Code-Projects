'use strict';

// The Package is past automatically as first parameter
module.exports = function(Mymodule, app, auth, database) {

    app.get('/mymodule/example/anyone', function(req, res, next) {
        res.send('Anyone can access this');
    });

    app.get('/mymodule/example/auth', auth.requiresLogin, function(req, res, next) {
        res.send('Only authenticated users can access this');
    });

    app.get('/mymodule/example/admin', auth.requiresAdmin, function(req, res, next) {
        res.send('Only users with Admin role can access this');
    });

    app.get('/mymodule/example/render', function(req, res, next) {
        Mymodule.render('index', {
            package: 'mymodule'
        }, function(err, html) {
            //Rendering a view from the Package server/views
            res.send(html);
        });
    });
};
