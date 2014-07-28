//This file gets overwritten by Jenkins with the current build number
// var sys = require('sys');

exports.buildinfo = {
	name: 'RTCP CP',
	version: process.env['BUILD_NUMBER'] ? process.env['BUILD_NUMBER'] : 'Not built with Jenkins'
};