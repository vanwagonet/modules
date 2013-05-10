(function(global, undefined) {
	'use strict';

	var doc = global.document, modules = {}, waits = {}, defines = {}, bunsMap = {},
		main = doc.getElementById('require-script') || doc.querySelector('[data-main]'),
		READONLY = { enumerable:true, writable:false, configurable:false },
		path, buns, noop = function(){}, props = Object.defineProperties || noop;
	if (!props({ t:true }, { t:READONLY }).t) { props = noop; } // detect disfunction in silk
	function each(arr, fn) { // it's actually a map, but it does double duty
		var i, ii = arr.length, map = [];
		for (i = 0; i < ii; ++i) { map[i] = fn(arr[i], i, arr); }
		return map;
	}

	path = main && main.src.replace(/[^\/\\]*$/, '');
	buns = JSON.parse(main && main.getAttribute('data-bundles') || null) || {};
	main = main && main.getAttribute('data-main') || false;
	function ready() { require(undefined, main, noop); }
	if (main) {
		if (doc.readyState !== 'loading') { setTimeout(ready, 13); }
		else if (!doc.addEventListener) { global.attachEvent('load', ready); }
		else { doc.addEventListener('DOMContentLoaded', ready); }
	}

	function define(id, deps, exp) {
		if ('string' !== typeof id) { throw new Error('define must be called with an id.'); }
		if (!exp) { exp = deps; deps = [ 'require', 'exports', 'module' ]; }
		var module = Module(undefined, id);
		module.children = each(deps, function(dep) { return Module(module, dep); });
		module.loaded = true;
		defines[id] = exp;
		props(module, { children:READONLY, loaded:READONLY });
		each(waits[id] || [], function(fn) { fn(module); });
	}
	define.bundle = function(id, bundle) {
		each((buns[id] = bundle).modules, function(m) { bunsMap[m] = bunsMap[m] || id; });
	};
	props(define, { bundle:READONLY });

	// there were modules shim defined before now.
	if (global.define) { each(global.define.d, function(args) { define.apply(undefined, args); }); }
	// make sure we map all of the bundles in the attribute
	for (i in buns) { define.bundle(i, buns[i]); }

	function bindm(fn, module) { return function(a1, a2) { return fn(module, a1, a2); }; }
	function makeRequire(module) {
		var mrequire = bindm(require, module);
		mrequire.ensure = bindm(ensure, module);
		mrequire.resolve = bindm(resolve, module);
		mrequire.cache = require.cache;
		props(mrequire, { ensure:READONLY, resolve:READONLY, cache:READONLY });
		if (mrequire.main = require.main) { props(mrequire, { main:READONLY }); }
		return mrequire;
	}

	function Module(parent, id) {
		if ('require' === id) { return { id:id, exports:parent.require, loaded:true }; }
		if ('exports' === id) { return { id:id, exports:parent.exports, loaded:true }; }
		if ('module' === id) { return { id:id, exports:parent, loaded:true }; }

		if (modules[(id = resolve(parent, id))]) { return modules[id]; }
		var uri = resolve({ id:path }, (bunsMap[id] ? bunsMap[id] : id)) + '.js',
			module = (modules[id] = { id:id, uri:uri, loaded:false });
		waits[id] = [];
		module.require = makeRequire(module);
		props(module, { id:READONLY, uri:READONLY, require:READONLY });
		return module;
	}

	function require(parent, id, fn) {
		if (fn) { return ensure(parent, id, fn); }
		var module = Module(parent, id);
		if (!module.loaded) { throw new Error('Module "' + id + '" (' + module.uri + ') was not found.'); }
		if (!('exports' in module)) {
			module.parent = parent; // first module to actually require this one is parent
			props(module, { parent:READONLY });

			if (!require.main) { // assume first executed module is main
				global.require.main = require.main = module;
				props(global.require, { main:READONLY });
			}

			// if define was passed a non-function, just assign it to exports
			if ('function' !== typeof defines[id = module.id]) { module.exports = defines[id]; }
			else {
				module.exports = {};
				var ret = each(module.children, function(child) { return require(module, child.id); });
				if (ret = defines[id].apply(global, ret)) { module.exports = ret; }
			}
			props(module, { exports:READONLY });
		}
		return module.exports;
	}
	require.cache = modules;

	function resolve(parent, id) {
		if (id.slice(-'.js'.length) === '.js') { id = id.slice(0, -'.js'.length); }
		if (!parent || !parent.id) { return id; }
		if (id.charAt(0) === '.') { id = parent.id.replace(/[^\/]+$/, id); }
		var orig = id.split('/'), terms = [], i, ii = orig.length;
		for (i = 0; i < ii; ++i) {
			if (orig[i] === '..') { terms.pop(); }
			else if (orig[i] !== '.') { terms.push(orig[i]); }
		}
		return terms.join('/');
	}

	function ensure(parent, ids, fn) {
		if (!ids.splice) { ids = [ ids ]; }
		var visited = {}, wait = 0,
			head = doc.head || doc.getElementsByTagName('head')[0];

		function done() {
			ids = each(ids, function(id) { return require(parent, id); });
			setTimeout(function() { fn.apply(global, ids); }, 13); // always async
		}
		function visit(module) {
			if (module.id in visited) { return; }
			return (visited[module.id] = module.loaded) ? each(module.children, visit) : load(module);
		}
		function load(module) {
			++wait;
			waits[module.id].push(function() {
				each(module.children, visit);
				if (--wait <= 0) { done(); }
			});
			if (doc.querySelector('script[src="' + module.uri.replace(/"/g, '\\"') + '"]')) { return; }
			var s = doc.createElement('script'); s.src = module.uri; s.async = s.defer = true;
			return head.appendChild(s);
		}

		each(ids, function(id) { visit(Module(parent, id)); });
		if (wait <= 0) { done(); }
	}

	global.global = global; // for greater nodejs compat
	global.define = define;
	global.require = makeRequire(); // convenient, not necessary as modules have local version
	props(global, { global:READONLY, define:READONLY, require:READONLY });
}(this));

