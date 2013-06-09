/**
 * Provides bundling modules into a single file
 **/
/* global setImmediate */
'use strict';

var modules = require('./modules'),
	async = require('async');

exports.cache = {};

// Finds all the modules' nested dependencies and provides the ids as an array
//  id can be a string or an array of absolute module ids
exports.dependencies = function dependencies(ids, options, next) {
	if (!next) { next = options; options = {}; }
	var opts = modules.getOptions(options),
		stack = [].concat(ids), list = [].concat(ids);
	opts.compress = false; // don't compress, as it could rename literal requires
	opts.nowrap.unshift({ test:function(){ return true; } }); // don't wrap either
	function visit(rid) {
		if (list.indexOf(rid) >= 0) { return; }
		list.push(rid);
		stack.push(rid);
	}
	(function loop() {
		if (!stack.length) { return next(null, list); }
		var id = stack.pop(), rlist = exports.cache[id];
		if (rlist) {
			rlist.forEach(visit);
			return (setImmediate || process.nextTick)(loop);
		}
		exports.module(id, opts, function(err, js, mtime) {
			var rlist = modules.dependencies(id, js, 'absolute');
			exports.cache[id] = rlist;
			rlist.forEach(visit);
			return (setImmediate || process.nextTick)(loop);
		});
	}());
};

// expand module id list to include all deep dependencies, and exclude the deep dependencies of the assumed ids
exports.expand = function expand(ids, assumed, options, next) {
	if (!next) { next = options; options = {}; }
	var opts = modules.getOptions(options);
	async.map([ ids, assumed ], function(list, next) {
		exports.dependencies(list, options, next);
	}, function(err, lists) {
		if (err) { return next(err); }
		assumed = lists[1];
		ids = lists[0].filter(function(id) {
			return assumed.indexOf(id) < 0;
		});
		next(null, ids);
	});
};

// create a module bundle from the list of includes and excludes
exports.bundle = function bundle(ids, assumed, options, next) {
	if (!next) { next = options; options = {}; }
	var opts = modules.getOptions(options);
	exports.expand(ids, assumed, opts, function(err, list) {
		if (err) { return next(err); }
		modules.modules(list, opts, next);
	});
};

