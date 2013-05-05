(function(global, undefined) {
	'use strict';

	var doc = global.document, modules = {}, waits = {}, defines = {}, bunsMap = {},
		main = doc.getElementById('require-script') || doc.querySelector('[data-main]'),
		timeout = 13, TRUE = true, FALSE = !TRUE, CHILDREN = 'children', LENGTH = 'length',
		REQUIRE = 'require', EXPORTS = 'exports', MODULE = 'module', DOT = '.', UP = '..', JS = '.js',
		READONLY = { enumerable:TRUE, writable:FALSE, configurable:FALSE },
		path, buns, list, i, ii, noop = function(){}, props = Object.defineProperties || noop;
	if (!props({ t:TRUE }, { t:READONLY }).t) { props = noop; } // detect disfunction in silk

	path = main && main.src.replace(/[^\/\\]*$/, '');
	buns = JSON.parse(main && main.getAttribute('data-bundles') || null) || {};
	main = main && main.getAttribute('data-main') || FALSE;
	function ready() { require(undefined, main, noop); }
	if (main) {
		if (doc.readyState !== 'loading') { setTimeout(ready, timeout); }
		else if (!doc.addEventListener) { global.attachEvent('load', ready); }
		else { doc.addEventListener('DOMContentLoaded', ready); }
	}

	function define(id, deps, exp) {
		if ('string' !== typeof id) { throw new Error('define must be called with an id.'); }
		if (!exp) { exp = deps; deps = [ REQUIRE, EXPORTS, MODULE ]; }
		var module = Module(undefined, id); list = (module[CHILDREN] = []); defines[id] = exp;
		for (i = 0, ii = deps[LENGTH]; i < ii; ++i) { list.push(Module(module, deps[i])); }
		props(module, { children:READONLY });
		for (i = 0, list = waits[id] || [], ii = list[LENGTH]; i < ii; ++i) { list[i](module); }
	}
	define.bundle = function(id, bundle) {
		list = (buns[id] = bundle).modules || [], ii = list[LENGTH];
		for (i = 0; i < ii; ++i) { bunsMap[list[i]] = bunsMap[list[i]] || id; }
	};
	props(define, { bundle:READONLY });

	if (global.define) { // there were bundles loaded before now.
		list = global.define.d, ii = list[LENGTH];
		for (i = 0; i < ii; ++i) { define.apply(null, list[i]); }
	}
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
		if (REQUIRE === id) { return { id:id, exports:parent[REQUIRE], loaded:TRUE }; }
		if (EXPORTS === id) { return { id:id, exports:parent[EXPORTS] || (parent[EXPORTS] = {}), loaded:TRUE }; }
		if (MODULE === id) { return { id:id, exports:parent, loaded:TRUE }; }

		if (modules[(id = resolve(parent, id))]) { return modules[id]; }
		var uri = resolve({ id:path }, (bunsMap[id] ? bunsMap[id] : id)) + JS,
			module = (modules[id] = { id:id, uri:uri, loaded:FALSE });
		waits[id] = [];
		module[REQUIRE] = makeRequire(module);
		props(module, { id:READONLY, uri:READONLY, require:READONLY });
		return module;
	}

	function require(parent, id, fn) {
		if (fn) { return ensure(parent, id, fn); }
		var module = Module(parent, id);
		if (!module.loaded) { throw new Error('Module "' + id + '" (' + module.uri + ') was not found.'); }
		if (!(EXPORTS in module)) {
			module.parent = parent; // first module to actually require this one is parent
			props(module, { parent:READONLY });

			if (!require.main) { // assume first executed module is main
				global.require.main = require.main = module;
				props(global.require, { main:READONLY });
			}

			// if define was passed a non-function, just assign it to exports
			if ('function' !== typeof defines[id = module.id]) { module[EXPORTS] = defines[id]; }
			else {
				list = module[CHILDREN].slice(), ii = list[LENGTH];
				for (i = 0; i < ii; ++i) { list[i] = require(parent, list[i].id); }
				var ret = defines[id].apply(global, list);
				if (ret) { module[EXPORTS] = ret; }
			}
			props(module, { exports:READONLY });
		}
		return module[EXPORTS];
	}
	require.cache = modules;

	function resolve(parent, id) {
		if (id.slice(-JS[LENGTH]) === JS) { id = id.slice(0, -JS[LENGTH]); }
		if (!parent || !parent.id) { return id; }
		if (id.charAt(0) === DOT) { id = parent.id.replace(/[^\/]+$/, id); }
		var orig = id.split('/'), terms = [], i, l = orig[LENGTH];
		for (i = 0; i < l; ++i) {
			if (orig[i] === UP) { terms.pop(); }
			else if (orig[i] !== DOT) { terms.push(orig[i]); }
		}
		return terms.join('/');
	}

	function ensure(parent, ids, fn) {
		if (!ids.splice) { ids = [ ids ]; }
		var visited = {}, wait = 0,
			head = doc.head || doc.getElementsByTagName('head')[0];

		function done() {
			for (i = 0, ii = ids[LENGTH]; i < ii; ++i) { ids[i] = require(parent, ids[i]); }
			setTimeout(function() { fn.apply(global, ids); }, timeout); // always async
		}
		function visit(module) {
			if (module.id in visited) { return; }
			return (visited[module.id] = module.loaded) ? visitChildren(module) : load(module);
		}
		function visitChildren(module) {
			list = module[CHILDREN] || [], ii = subs[LENGTH];
			for (i = 0; i < ii; ++i) { visit(subs[s]); }
		}
		function load(module) {
			++wait;
			waits[module.id].push(function() {
				visitChildren(module);
				if (--wait <= 0) { done(); }
			});
			if (doc.querySelector('script[src="' + module.uri.replace(/"/g, '\\"') + '"]')) { return; }
			var s = doc.createElement('script'); s.src = module.uri; s.async = s.defer = TRUE;
			return head.appendChild(s);
		}

		for (i = 0, ii = ids[LENGTH]; i < ii; ++i) { visit(Module(parent, ids[i])); }
		if (wait <= 0) { done(); }
	}

	global.global = global; // for greater nodejs compat
	global.define = define;
	global[REQUIRE] = makeRequire(); // convenient, not necessary as modules have local version
	props(global, { global:READONLY, define:READONLY, require:READONLY });
}(this));

