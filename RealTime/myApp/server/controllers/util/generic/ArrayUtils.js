
'use strict';
var _ = require('lodash');

var ArrayUtils = function (size) {

    if (ArrayUtils.prototype._singletonInstance) {
        return ArrayUtils.prototype._singletonInstance;
    }

    ArrayUtils.prototype._singletonInstance = this;

    //private vars

    //Takes an array of objects and flattens it into an array without nested key/value pairs
    this.flattenArray = function(array) {
        var copy = [];
        for (var i = 0; i < array.length; i++) {
            var j = this.flatten(array[i]);
            copy.push(this.flatten(array[i]));
        }
        return copy;
    }

    //Takes an object with keys and possibly nested key/value pairs
    //and flattens it into an object without nested key/value pairs
    this.flatten = function(idx) {
        var flattened = {};
        for (var key in idx) {
            if (idx[key] instanceof Object) {
                var _flattened = this.flatten(idx[key]);
                for (var key2 in _flattened) {
                    flattened[key + '.' + key2] = _flattened[key2];
                }
            } else {
                flattened[key] = idx[key];
            }
        }
        return flattened;
    }
};

module.exports = ArrayUtils;