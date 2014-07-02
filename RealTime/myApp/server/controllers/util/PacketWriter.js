//PacketWriter.js
//Will write incoming RTCP packets to file if toggled on.
//Each time the PacketWriter is toggled from off to on, a new
//session id var is created which will create a directory
//and store all received packets in that directory
//THe packets are meant to be consumed by the packet simulator

var fs = require('fs');

var PacketWriter = function () {

    if (PacketWriter.prototype._singletonInstance) {
        return PacketWriter.prototype._singletonInstance;
    }

    PacketWriter.prototype._singletonInstance = this;

    var msgCount = 0;
    var sessionId = makeid();
    var captureOn = false;
    //a map of ips and counts
    var writeMap = {};

    function makeid(length) {
        var text = '';
        var len = length ? length : 5;  //default length
        var count = 0;
        do {
            text = '';
            var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

            for (var i = 0; i < len; i++) {
                text += possible.charAt(Math.floor(Math.random() * possible.length));
            }

            count += 1;

        } while (fs.existsSync('packets/' + text) && count < 100);
        
        return text;
    }

    function createDirSync(sessionId) {
        try {
            fs.mkdirSync('packets/' + sessionId);
        } catch(e) {
            if (e.code === 'EEXIST') {
                console.err('SESSION ID was not unique!')
            } else {
                throw e;
            }
        }
    }

    function readSessionsSync() {
        try {
            var files = fs.readdirSync('packets/');
            var dirs = [];
            for (var i = 0; i < files.length; i++) {
                if (fs.statSync('packets/' + files[i]).isDirectory()) {
                    var f = fs.readdirSync('packets/' + files[i]);
                    dirs.push({
                        sessionId: files[i].toString(),
                        count: f.length
                    });
                }
            }
            return dirs;
        } catch(e) {
            throw e;
        }
    }

    function writeToFile(msg, filename) {
        if (!filename) {
            filename = 'rtcp_packets_' + makeid();
        }
        console.log('---Writing byte stream to: ' + filename);
        var sessionId = filename.split('_')[2];
        var wstream = fs.createWriteStream('./packets/' + sessionId + '/' + filename);
        wstream.write(msg);
        wstream.end();
        console.log('---Done.');
    }

    function reset() {
        sessionId = makeid();
        msgCount = 0;
        writeMap = {};
    }


    this.setCapture = function(capture) {
        if (captureOn === false && capture === true) {  //reset sessionId, message count
            reset();
        }
        captureOn = capture;
    };

    this.getCapture = function() {
        return {
            sessionId: sessionId,
            captureOn: captureOn,
            msgCount: msgCount,
            writeMap: writeMap,
            availableSessions: readSessionsSync()
        }
    };

    this.downloadCapture = function(sessionId) {

    };

    this.write = function(msg, rinfo) {
        if (msgCount === 0 && captureOn) {  //only in this state create a dir for the packets
            createDirSync(sessionId);
        }
        //var decoded = decode(msg, rinfo, filename, captureOn);
        if (!writeMap[rinfo.address]) {
            writeMap[rinfo.address] = {
                count: 0
            };
        }
        var filename = 'rtcp_packets_' + sessionId + '_' + 
            rinfo.address + '_' + writeMap[rinfo.address].count + '_' + new Date().getTime();
        writeToFile(msg, filename);
        writeMap[rinfo.address].count += 1;
        msgCount += 1; //keeps track of number of udp received
    };
};

module.exports = PacketWriter;