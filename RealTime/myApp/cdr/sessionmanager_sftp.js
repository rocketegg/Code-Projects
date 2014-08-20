var fs = require("fs");
var sys  = require("sys");
var Connection  =  require('ssh2');
var async = require('async');

var ftphost =  "10.30.12.15";
var user  =  "CDR_User";
var password = "C/arus02";
var lastmodifiedtime = 12;
var remoteFileDir = " ";
var localFileDir = "/Users/nraghu/Documents/SMFtpFiles";
//var localNodejsprcessingDir = "/Users/nraghu/Documents/NodeJsSMFiles";
var retycount = 0;
var conn = new Connection();
var localsftp = null;
var failedXferFiles = {};


if ( typeof String.prototype.startsWith != 'function' ) {
	  String.prototype.startsWith = function( str ) {
	    return str.length > 0 && this.substring( 0, str.length ) === str;
	  };
};

var hasOwnProperty = Object.prototype.hasOwnProperty;

/*
 * This is a function to see if an object is empty
 */
function isEmpty(obj) {

    // null and undefined are "empty"
    if (obj == null) return true;

    // Assume if it has a length property with a non-zero value
    // that that property is correct.
    if (obj.length > 0)    return false;
    if (obj.length === 0)  return true;

    // Otherwise, does it have any properties of its own?

    for (var key in obj) {
        if (hasOwnProperty.call(obj, key)) return false;
    }

    return true;
};


/*
 * The final async call back when all sftp for the files are done.
 * This could be invoked upto 3 times if some files cannot make it in first or second attempt
 */
  var asyncCb = function(err) {
	  retrycount = retrycount + 1;
	  console.log("Calling async Call Back with retry count " + retrycount);
    if (err) throw err;
    console.log("Files that failed to xfer are " + JSON.stringify(failedXferFiles));
    if ((!isEmpty(failedXferFiles)) && (localsftp != null))   {
    	 if (retrycount < 4) {
    	  async.each(failedXferFiles, function(currentfile, eachFileCb) {
    		  var filename = currentfile.filename,
    	      attrs = currentfile.attrs,
    	      size = attrs.size;
     		  var srcFile  = "/" + filename;
    	      var destFile = localFileDir + '/' + filename;
    		  console.log("Xfer files " + srcFile + " dest file " + destFile + " size = " + size);
    		  var xfer = false;
    		  localsftp.fastGet(srcFile, destFile, function(err) {
     	      if (err) {
    	        console.log(err);
    	        xfer  = false;
    	      } else {
    	        xfer = checkFileSize(srcFile,destFile,size);
    	      }
    	      if (xfer) {
    	    	  console.log('File transfer of file ' + srcFile + ' succeeded');
    	    	  delete failedXferFiles[filename];
    	    	  console.log("deleted filename " + filename + " from the array");
    	      } else {
    	    	  
    	      }
    	      eachFileCb();
    		  });
    	  }, asyncCb); 
    	 } else {
    		 console.log(" Already tried 3 times and the following files could not be transferred" + JSON.stringify(failedXferFiles))
     	 }
     } else {
    	 console.log('Done with all files!');
    	 conn.end();
    } 
  };
  
  var eachFileCb = function(err) {
	  if (err != null) {
	     console.log("Could not sftp file " + err.file + " because of error " + JSON.stringify(err));
	  }
  };
  
  function checkFileSize(srcFile, localfile, origSize)  {
	  var stats = fs.statSync(localfile);
	  var newSize  = stats["size"];
	  if (newSize != origSize) {
		  console.log(localfile + " was not completely transferred Source file size = " + origSize + " new file size = " + newSize);
		 return false;
	  } else {
		  console.log(localfile + " File sizes match  Source file size = " + origSize + " new file size = " + newSize);
		  return true;
	  }
  };
  
  
  function removeArrayElement (arr, removeElement) {
	  var index = arr.indexof(removeElement);
	  if (index > -1) {
		  array.splice(index,1);
	  }
  }
  
  function get(sftp, currentfile) {
	  
	  var filename = currentfile.filename,
      attrs = currentfile.attrs,
      size = attrs.size;
      
	  var srcFile  = "/" + filename;
      var destFile = localFileDir + '/' + filename;
	  console.log("Xfer files " + srcFile + " dest file " + destFile + " size = " + size);
	  var xfer = false;
	  sftp.fastGet(srcFile, destFile, function(err) {
      // you can abort early by using `cb(err);` instead if there is an error
      //if (err) err.file = currentfile;
      //eachFileCb(err);

      if (err) {
        console.log(err);
        xfer  = false;
      } else {
        
        xfer = checkFileSize(srcFile,destFile,size);
      }
      
      if (xfer) {
    	  console.log('File transfer of file ' + srcFile + ' succeeded');
    	  delete failedXferFiles[filename];
    	  console.log("deleted filename " + filename + " from the array");
      } else {
    	  
      }
      eachFileCb();
	  });
	 
  }

conn.on('ready', function() {
	  retrycount = 0;
	  failedXferFiles = new Array();
	  console.log('Connection :: ready');
	  conn.sftp(function(err, sftp) {
	      if (err) throw err;
	      localsftp = sftp;
	      sftp.readdir('/', function(err, filelist) {
	    	  if (err) throw err;
	    	  
	    	  async.each(filelist, function(currentfile, eachFileCb) {
	    		 
	    	    var filename = currentfile.filename,
	    	        attrs = currentfile.attrs,
	    	        size = attrs.size,
	    	        mtime = attrs.mtime;
	    	   
	    	    if ((mtime > lastmodifiedtime) && (filename.startsWith('S000')))  {
	    	    
	    	      failedXferFiles[filename] = currentfile;
	    		  var srcFile  = "/" + filename;
	    	      var destFile = localFileDir + '/' + filename;
	    		  console.log("Xfer files " + srcFile + " dest file " + destFile + " size = " + size);
	    		  var xfer = false;
	    		  sftp.fastGet(srcFile, destFile, function(err) {
	    	      // you can abort early by using `cb(err);` instead if there is an error
	    	      //if (err) err.file = currentfile;
	    	      //eachFileCb(err);

	    	      if (err) {
	    	        console.log(err);
	    	        xfer  = false;
	    	      } else {
	    	        xfer = checkFileSize(srcFile,destFile,size);
	    	      }
	    	      
	    	      if (xfer) {
	    	    	  console.log('File transfer of file ' + srcFile + ' succeeded');
	    	    	  delete failedXferFiles[filename];
	    	    	  console.log("deleted filename " + filename + " from the array");
	    	      } else {
	    	      }
	    	      eachFileCb();
	    		  });

	    	    } else
	    	    	eachFileCb();
	    	  }, asyncCb);  
	      });
	  });
}).connect({
	  host: ftphost,
	  port: 22,
	  username: user,
	  password: password,
	  debug : function(msg) {
		  console.log(msg);
	  }
});
