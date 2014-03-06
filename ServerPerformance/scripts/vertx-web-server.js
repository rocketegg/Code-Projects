var vertx = require('vertx');

var server = vertx.createHttpServer();

server.requestHandler(function(req) {
var file = '';

  if (req.path() == '/show') {
  	  req.response.chunked(true);
  	  req.response.putHeader('content-type','text/html');
      req.response.write("Hello: ");
      req.response.end();
  } else if (req.path() == '/version') {
  	  req.response.chunked(true);
  	  req.response.putHeader('content-type','text/html');
      req.response.write('Vertx version: ' + '2.0.2-final (built 2013-10-08 10:55:59');
      req.response.end();
  } else if (req.path() == '/') {
    file = 'index.html';
    req.response.sendFile('app/' + file);   
  } else if (req.path().indexOf('..') == -1) {
    file = req.path();
    req.response.sendFile('app/' + file);   
  }
  
});

server.listen(8001, 'localhost');