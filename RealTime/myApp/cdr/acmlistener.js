var net  = require('net');
var PORT  = 10001;
var outputFile  = "/Users/nraghu/Documents/ACMOutput/acmcdroutput.csv";

var fs  =  require('fs');
var fswriteoptions = {flags:'a', encoding : 'utf-8'};
var wstream  = fs.createWriteStream(outputFile,fswriteoptions);
wstream.on('finish', function () {
	  console.log('file has been written');
	});



var decoders = {
	    105: decode_unformatted,
	    123: decode_enhanced_unformatted
	};

	//Entry method
	function decode (buffer) {
	    try {
	        var timestamp = new Date().getTime();
	        console.log('[DECODE]: Decoding CDR message with timestamp: %s.', timestamp);
	     
	        var decoded = buffer.toString('ascii');
	        console.log('[DECODE]: Decoding CDR message with timestamp: %s.', decoded);
	        //If statement depending on the type of CDR format 
	        var _decoder = decoders[buffer.length];
	        if (_decoder) {
	            console.log(decoded);
	            return _decoder(decoded);
	        } else {
	            console.log('[CDR]: incoming CDR data of unknown length');
	            return undefined;
	        }
	    } catch (err) {
	        throw err;
	    }
	}

	var avaya_unformatted_map = {
	    TIME_OF_DAY_HOURS: {
	        start: 1,
	        size: 2
	    }, 
	    TIME_OF_DAY_MINUTES: {
	        start: 3,
	        size: 2
	    },
	    DURATION_HOURS: {
	        start: 5,
	        size: 1
	    },
	    DURATION_MINUTES: {
	        start: 6,
	        size: 2
	    },
	    DURATION_TENTHS_OF_MINUTES: {
	        start: 8,
	        size: 1
	    },
	    CONDITION_CODE: {
	        start: 9,
	        size: 1
	    },
	    ACCESS_CODE_DIALED: {
	        start: 10,
	        size: 4
	    },
	    ACCESS_CODE_USED: {
	        start: 14,
	        size: 4
	    },
	    DIALED_NUMBER: {
	        start: 18,
	        size: 15
	    },
	    CALLING_NUMBER: {
	        start: 33,
	        size: 10
	    },
	    ACCOUNT_CODE: {
	        start: 43,
	        size: 15
	    },
	    AUTH_CODE: {
	        start: 58,
	        size: 7
	    },
	    FRL: {
	        start: 67,
	        size: 1
	    },
	    IN_CIRCUIT_ID: {
	        start: 68,
	        size: 3
	    },
	    OUT_CIRCUIT_ID: {
	        start: 71,
	        size: 3
	    },
	    FEATURE_FLAG: {
	        start: 74,
	        size: 1
	    },
	    ATT_CONSOLE: {
	        start: 75,
	        size: 4
	    },
	    IN_TAC: {
	        start: 79,
	        size: 4
	    },
	    NODE_NUMBER: {
	        start: 83,
	        size: 2
	    },
	    INS: {
	        start: 85,
	        size: 5
	    },
	    IXC: {
	        start: 90,
	        size: 3
	    },
	    BCC: {
	        start: 93,
	        size: 1
	    },
	    MA_UUI: {
	        start: 94,
	        size: 1
	    },
	    RES_FLAG: {
	        start: 95,
	        size: 1
	    },
	    PACKET_COUNT: {
	        start: 96,
	        size: 4
	    },
	    TSC: {
	        start: 100,
	        size: 1
	    }
	    
	   
	};
	
	var avaya_enhanced_unformatted_map = {
		    TIME_OF_DAY_HOURS: {
		        start: 0,
		        size: 2
		    }, 
		    TIME_OF_DAY_MINUTES: {
		        start: 2,
		        size: 2
		    },
		    DURATION_HOURS: {
		        start: 4,
		        size: 1
		    },
		    DURATION_MINUTES: {
		        start: 5,
		        size: 2
		    },
		    DURATION_TENTHS_OF_MINUTES: {
		        start: 7,
		        size: 1
		    },
		    CONDITION_CODE: {
		        start: 8,
		        size: 1
		    },
		    ACCESS_CODE_DIALED: {
		        start: 9,
		        size: 4
		    },
		    ACCESS_CODE_USED: {
		        start: 13,
		        size: 4
		    },
		    DIALED_NUMBER: {
		        start: 17,
		        size: 15
		    },
		    CALLING_NUMBER: {
		        start: 32,
		        size: 10
		    },
		    ACCOUNT_CODE: {
		        start: 42,
		        size: 15
		    },
		    AUTH_CODE: {
		        start: 57,
		        size: 7
		    },
		    FRL: {
		        start: 66,
		        size: 1
		    },
		    IN_CIRCUIT_ID: {
		        start: 67,
		        size: 3
		    },
		    OUT_CIRCUIT_ID: {
		        start: 70,
		        size: 3
		    },
		    FEATURE_FLAG: {
		        start: 73,
		        size: 1
		    },
		    ATT_CONSOLE: {
		        start: 74,
		        size: 4
		    },
		    IN_TAC: {
		        start: 78,
		        size: 4
		    },
		    NODE_NUMBER: {
		        start: 82,
		        size: 2
		    },
		    INS: {
		        start: 84,
		        size: 5
		    },
		    IXC: {
		        start: 89,
		        size: 4
		    },
		    BCC: {
		        start: 93,
		        size: 1
		    },
		    MA_UUI: {
		        start: 94,
		        size: 1
		    },
		    RES_FLAG: {
		        start: 95,
		        size: 1
		    },
		    PACKET_COUNT: {
		        start: 96,
		        size: 4
		    },
		    TSC: {
		        start: 100,
		        size: 1
		    },
		    BANDWIDTH: {
		        start: 101,
		        size: 2
		    },
		    ISDN_CC: {
		        start: 103,
		        size: 6
		    },
		    ISDN_CC_PPM: {
		        start: 109,
		        size: 5
		    }
		};

	function decode_unformatted (string) {
	    var decoded = {};
	    for (var key in avaya_unformatted_map) {
	        var _str = string.substring(avaya_unformatted_map[key].start, avaya_unformatted_map[key].start + avaya_unformatted_map[key].size);
	        decoded[key] = _str;
	    }
	    return decoded;
	}

	function decode_enhanced_unformatted (string) {
		 var decoded = {};
		    for (var key in avaya_enhanced_unformatted_map) {
		        var _str = string.substring(avaya_enhanced_unformatted_map[key].start, avaya_enhanced_unformatted_map[key].start + avaya_enhanced_unformatted_map[key].size);
		        decoded[key] = _str;
		    }
		    return decoded;
	}

	 var heading =  "";
	 var firstcol = true;
	for (var key in avaya_enhanced_unformatted_map) {
		if (!firstcol) {
			heading  = heading.concat(",");
		} else {
			firstcol = false;
		}
		heading  = heading.concat(key);
	}
	heading  =  heading + "," + "ACMADDRESS";
	heading = heading.concat("\n");
    var filelinevalue = null;
    var firstline = true;
	var _cdrServer = net.createServer(function(c) { //'connection' listener
		
		  console.log('CDR Server connected');

		  // Add a 'data' event handler to this instance of socket
		  c.on('data',function(data)  {
		    
		    console.log('[CDR] INCOMING CDR MESSAGE FROM [%s:%s] with LENGTH [%d]: ', c.remoteAddress, c.remotePort, data.length);
		    var _decodedObj =decode(data)
		    if (_decodedObj) {
		    	_decodedObj["ACMADDRESS"] = 	c.remoteAddress;
		      console.log('[CDR] Received decoded message: \n');
		      console.log(_decodedObj);
		
		      if (firstline) {
		    	  wstream.write(heading);
		    	  console.log(heading);
		    	  firstline = false;
		      }
		      filelinevalue ="";
		      var firstvalue = true;
		      for (var key in avaya_enhanced_unformatted_map) {
		    	  if (!firstvalue) {
		    		  filelinevalue = filelinevalue.concat(",");
		    	  } else {
		    		  firstvalue =  false;
		    	  }
		    	  filelinevalue = filelinevalue.concat( _decodedObj[key]);
		      }
		      filelinevalue = filelinevalue + "," +  _decodedObj["ACMADDRESS"];
		     // wstream.write(JSON.stringify(_decodedObj));
		      wstream.write(filelinevalue + "\n");
		      console.log(filelinevalue + "\n");
		    } 
		  });
		  
		  //Add a 'close' event handler to this instance of socket
		  c.on('close',function(data) {
		    console.log('CLOSED:' +  c.remoteAddress + ' ' + c.remotePort);
		    wstream.end();
		  });

		  c.on('end', function() {
		    console.log('CDR Server disconnected');
		  });

		  //c.write('hello\r\n');

		  //c.pipe(c);
		});
		_cdrServer.listen(PORT, function() { //'listening' listener
		  console.log('Opening up CDR listener on port ' + PORT );
		});





// create a server instance, and chain the listen function to it
// The function passed to net.createServer() becomes the event handler for
// The sock object the callback function receives UNIQUE for each connection
/* net.createServer(function(sock)  {
	console.log('CONECTED: ' + sock.remoteAddress + ':' + sock.remotePort);
	
	// Add a 'data' event handler to this instance of socket
	sock.on('data',function(data)  {
		
		
		console.log('DATA ' + sock.remoteAddress + ': ' + data);
		var dataLen  = data.length();
		if (dataLen >= 123) {
			data.substring(1)
			
		}
		// Write the data back to the socket , the client will receive it a 
		sock.write ('You said"' + data + '"');
	});
	
	//Add a 'close' event handler to this instance of socket
	sock.on('close',function(data) {
		console.log('CLOSED:' +  sock.remoteAddress + ' ' + sock.remotePort)
	});

}).listen(PORT,HOST); 

console.log('Server listening on '+  HOST + ':' + PORT);  */
