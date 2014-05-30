'use strict';

// Articles routes use articles controller
var calls = require('../controllers/calls');
var authorization = require('./middlewares/authorization');

module.exports = function(app) {
    app.get('/calls/active', calls.allactivecalls);
    app.get('/calls/:callId/packets', authorization.requiresLogin, calls.getcallpackets);
    app.get('/calls/:callId', calls.show);
    app.get('/calls', calls.all);
    
    // Finish with setting up the articleId param
    app.param('callId', calls.call);
};