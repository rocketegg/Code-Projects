'use strict';

// packets routes use packets controller
var analytics = require('../controllers/analytics');

module.exports = function(app) {
    app.post('/analytics/reduce', analytics.reduce);
};