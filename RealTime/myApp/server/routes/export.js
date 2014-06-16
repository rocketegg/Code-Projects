'use strict';

// Articles routes use articles controller
var exporter = require('../controllers/export'),
	calls = require('../controllers/calls'),
	devices = require('../controllers/devices');

var authorization = require('./middlewares/authorization');

module.exports = function(app) {
	app.get('/export/call/:callId', exporter.exportcall);
	app.get('/export/device/:deviceId', exporter.exportdevice);
	app.post('/export/packets', exporter.exportpackets);
    app.post('/export/object', exporter.exportobject);

    app.param('callId', calls.call);
    app.param('deviceId', devices.device);
};