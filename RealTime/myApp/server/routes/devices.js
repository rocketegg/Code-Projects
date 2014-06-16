'use strict';

// Articles routes use articles controller
var devices = require('../controllers/devices');
var authorization = require('./middlewares/authorization');

module.exports = function(app) {
	//Returns the 1, 5, 10 and hour slice for the device IP
	app.get('/device/find/summary', devices.findsummarybyip);

	//Returns a comma separated line for a device by IP address
	//basically an aggregate of the summary and analytics/qos REST calls
	app.get('/device/find/snapshot', devices.snapshot);

	app.get('/device/find', devices.findbyip);
    app.get('/device/all', devices.all);
    app.get('/device/:deviceId', devices.show);
    // Finish with setting up the articleId param
    app.param('deviceId', devices.device);
};