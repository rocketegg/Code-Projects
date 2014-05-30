//Responsible for aggregating data within last time slice
//Author: Al Ho 2/22/2014
'use strict';
var Reducer = require('./MapReduce.js'),
    Filterer = require('./Filterer.js');

var Aggregator = function () {
    return {
        //TODO serialize these through call backs
        aggregateAll: function(cb) {
            var _reducer = new Reducer();
            var _filterer = new Filterer();
            var lastRun = new Date().getTime() - 5000;
            //console.log('[AGGREGATOR] Aggregating results @ [%s]', new Date());
            _filterer.query(lastRun);
            //_reducer.query(lastRun);
        }
    };
};

module.exports = Aggregator;