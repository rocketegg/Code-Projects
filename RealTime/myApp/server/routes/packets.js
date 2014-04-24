'use strict';

// packets routes use packets controller
var packets = require('../controllers/packets');

module.exports = function(app) {

    app.get('/packets', packets.all);
    app.post('/packets/start', packets.start);
    app.post('/packets/stop', packets.stop);
    app.get('/packets/slice', packets.slice);
    app.get('/packets/status', packets.checkjobstatus);
    app.post('/packets/refresh', packets.refresh);
    app.post('/packets', packets.create);
    app.get('/packets/:packetId', packets.show);
    app.put('/packets/:packetId', packets.update);
    app.del('/packets/:packetId', packets.destroy);

    // Finish with setting up the packetId param
    app.param('packetId', packets.packet);

};