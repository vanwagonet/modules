(function(global){
	"use strict";

	var doc = global.document, modules = {}, defs = {}, path, ext = '.js',
		area = doc.createElement('textarea'), main = doc.getElementById('require-script'),
		READONLY = { enumerable:true, writable:false, configurable:false },
		defineProperties = Object.defineProperties || function(){};

	function decode(s) { area.innerHTML = String(s); return area.value; }
	path = main && decode(main.src).replace(/[^\/\\]*$/, '');
	main = main && decode(main.getAttribute('data-main') || '') || false;
	function ready() { ensure(main, function() { require(main); }); }
	if (main) {
		if (doc.readyState !== 'loading') { setTimeout(ready, 1); }
		else if (!doc.addEventListener) { global.attachEvent('load', ready); }
		else { doc.addEventListener('DOMContentLoaded', ready); }
	}

	function define(id, fn) { defs[id] = fn; }
	if (global.define) { // there were packages loaded before now.
		for (var id in global.define.defs) { defs[id] = global.define.defs[id]; }
	}

	function require(oid, parent) {
		var id = resolve(oid, parent && parent.id), uri = resolve(id, path) + ext;
		if (!defs[id]) { throw new Error('Module "' + oid + '" (' + uri + ') was not found.'); }
		if (!modules[id]) {
			var module = (modules[id] = { exports:{}, id:id, uri:uri, loaded:false, parent:parent, children:[] }),
				req = module.require = function(sid) { return require(sid, module); };
			defineProperties(module, { id:READONLY, uri:READONLY, children:READONLY, require:READONLY });

			if (!global.require.main) { // assume first executed module is main
				global.require.main = module;
				defineProperties(global.require, { main:READONLY });
			}

			req.ensure = function(sid, fn) { return ensure(resolve(sid, id), fn); };
			req.resolve = function(sid) { return resolve(sid, id); };
			req.main = global.require.main;
			req.cache = modules;
			defineProperties(req, { ensure:READONLY, resolve:READONLY, main:READONLY, cache:READONLY });

			if (parent) { parent.children.push(module); }
			defs[id].call(global, req, module.exports, module);
			module.loaded = true;
			defineProperties(module, { exports:READONLY, loaded:READONLY });
		}
		modules[id].parent = parent;
		return modules[id].exports;
	}

	function resolve(id, base) {
		if (id.slice(-ext.length) === ext) { id = id.slice(0, -ext.length); }
		if (!base) { return id; }
		if (id.charAt(0) === '.') { id = base.replace(/\w+$/, id); }
		var orig = id.split('/'), terms = [], i, l = orig.length;
		for (i = 0; i < l; ++i) {
			if (orig[i] === '..') { terms.pop(); }
			else if (orig[i] !== '.') { terms[terms.length] = orig[i]; }
		}
		return terms.join('/');
	}

	function ensure(id, fn) {
		if (defs[id]) { return fn(); } // assume all dependencies already loaded

		var head = doc.head || doc.getElementsByTagName('head')[0];
		function script(id, done) {
			var s = doc.createElement('script');
			s.src = path + id + ext;
			s.onload = s.onerror = done;
			s.async = s.defer = true;
			return head.appendChild(s);
		}

		if (/\.json$/i.test(id)) { return script(id, fn); }

		var xhr = new global.XMLHttpRequest();
		xhr.open('GET', path + id + '/dependencies.json', true);
		xhr.onload = function() {
			var mods = JSON.parse(xhr.responseText),
				m, mm = mods.length, left = mm;
			function check() { if (!--left) { fn(); } }
			for (m = 0; m < mm; ++m) {
				if (defs[mods[m]]) { --left; }
				else { script(mods[m], check); }
			}
			if (!left) { fn(); }
		};
		xhr.send();
	}

	global.global = global;
	global.define = define;
	global.require = function(id) { return require(id); };
	global.require.ensure = ensure;
	global.require.resolve = resolve;
	global.require.cache = modules;
	defineProperties(global.require, { ensure:READONLY, resolve:READONLY, cache:READONLY });
	define('require', function(r,e,module) { module.exports = module.parent ? module.parent.require : global.require; });
}(this));

