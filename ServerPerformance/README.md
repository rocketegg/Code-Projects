# Server Performance

This project tests some node.js (and later on other server) performance by making lots of http requests on the backend.  This is build on angular-seed.

There's a basic form that allows a user to adjust certain variables:


### Running the app

Run the node server. 

* serve this repository with your webserver
* install node.js and run `scripts/web-server.js`

Then navigate your browser to `http://localhost:<port>/app/index.html` to see the app running in
your browser.

The variables:
* Iterations - number of http requests to make
* Block Size - How often a result is computed (reports start time for request, end time, average time per call (ms) and total time (ms) )
* Range - How many results to display on screen
* Polling - Toggle On/Off (this will start polling requests as fast as node.js can handle them.  These are serial in nature).
* Show Graph - toggle graphing on/off (off will provide better javascript performance)


## Contact

For angular seed, see https://github.com/angular/angular-seed
For the graphing, see http://bouil.github.io/angular-google-chart/#/fat

For more information on AngularJS please check out http://angularjs.org/
