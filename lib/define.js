(function(global, undefined) {
	'use strict';

	var doc = global.document, modules = {}, waits = {}, factories = {}, bundleMap = {},
		main = doc.querySelector('#require-script,[data-main]'), path, bundles;
	function each(fn, arr) { // it's actually a map, but it does double duty
		var i, ii = arr.length, map = [];
		for (i = 0; i < ii; ++i) { map[i] = fn(arr[i], i, arr); }
		return map;
	}

	path = main && main.src.replace(/[^\/\\]*$/, '');
	bundles = JSON.parse(main ? main.getAttribute('data-bundles') : null) || {};
	main = main && main.getAttribute('data-main') || false;
	function ready() { require(undefined, main, function(){}); }
	if (main) {
		if (doc.readyState !== 'loading') { setTimeout(ready, 13); }
		else if (!doc.addEventListener) { global.attachEvent('load', ready); }
		else { doc.addEventListener('DOMContentLoaded', ready); }
	}

	function define(id, deps, exp) {
		if (!exp) { exp = deps; deps = [ 'require', 'exports', 'module' ]; }
		var module = Module(undefined, id);
		module.children = each(function(dep) { return Module(module, dep); }, deps);
		module.loaded = true;
		factories[id] = exp;
		each(function(fn) { fn(module); }, waits[id] || []);
	}
	define.bundle = function(id, bundle) {
		each(function(m) { bundleMap[m] = bundleMap[m] || id; }, (bundles[id] = bundle).modules);
	};

	// there were modules shim defined before now.
	if (global.define) { each(function(args) { define.apply(undefined, args); }, global.define.d); }
	// make sure we map all of the bundles in the attribute
	for (i in bundles) { define.bundle(i, bundles[i]); }

	function bindm(fn, module) { return function(a1, a2) { return fn(module, a1, a2); }; }
	function makeRequire(module) {
		var mrequire = bindm(require, module);
		mrequire.ensure = bindm(ensure, module);
		mrequire.resolve = bindm(resolve, module);
		mrequire.cache = require.cache;
		mrequire.main = require.main;
		return mrequire;
	}

	function Module(parent, id) {
		if ('require' === id) { return { id:id, loaded:true, exports:parent.require }; }
		if ('exports' === id) { return { id:id, loaded:true, exports:parent.exports }; }
		if ('module' === id) { return { id:id, loaded:true, exports:parent }; }

		if (modules[(id = resolve(parent, id))]) { return modules[id]; }
		var uri = resolve({ id:path }, bundleMap[id] || id) + '.js',
			module = (modules[id] = { id:id, uri:uri, loaded:false });
		waits[id] = [];
		module.require = makeRequire(module);
		return module;
	}

	function require(parent, id, fn) {
		if (fn) { return ensure(parent, id, fn); }
		var module = Module(parent, id);
		if (!module.loaded) { throw new Error(id + ' not found'); }
		if (!('exports' in module)) {
			module.parent = parent; // first module to actually require this one is parent

			// if define was passed a non-function, just assign it to exports
			if ('function' !== typeof factories[id = module.id]) { module.exports = factories[id]; }
			else {
				module.exports = {};
				var ret = each(function(child) { return require(module, child.id); }, module.children);
				if (ret = factories[id].apply(global, ret)) { module.exports = ret; }
			}
		}
		return module.exports;
	}
	require.cache = modules;
	require.main = main ? Module(undefined, main) : undefined;

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
		var visited = {}, wait = 0, head = doc.querySelector('head');

		function done() {
			ids = each(function(id) { return require(parent, id); }, ids);
			setTimeout(function() { fn.apply(global, ids); }, 13); // always async
		}
		function visit(module) {
			if (module.id in visited) { return; }
			return (visited[module.id] = module.loaded) ? each(visit, module.children) : load(module);
		}
		function load(module) {
			++wait;
			waits[module.id].push(function() {
				each(visit, module.children);
				if (--wait <= 0) { done(); }
			});
			if (doc.querySelector('script[src="' + module.uri.replace(/"/g, '\\"') + '"]')) { return; }
			var s = doc.createElement('script');
			s.src = module.uri;
			s.async = s.defer = true;
			return head.appendChild(s);
		}

		each(function(id) { visit(Module(parent, id)); }, ids);
		if (wait <= 0) { done(); }
	}

	global.global = global; // for greater nodejs compat
	global.define = define;
	global.require = makeRequire(); // convenient, not necessary as modules have local version
}(this));

