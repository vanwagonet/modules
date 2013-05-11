(function(global, undefined) {
	var doc = global.document, modules = {}, waits = {}, factories = {}, bundleMap = {},
		main = doc.querySelector('[data-main],[data-bundles]') || undefined,
		path = main ? main.src.replace(/[^\/]+$/, '') : '',
		bundles = JSON.parse(main ? main.getAttribute('data-bundles') : '{}') || {};

	if (main = main && main.getAttribute('data-main')) {
		main = Module(undefined, main);
		if ('loading' !== doc.readyState) { setTimeout(function() { require(undefined, main.id, function(){}); }, 13); }
		else { doc.addEventListener('DOMContentLoaded', function() { require(undefined, main.id, function(){}); }, false); }
	}

	function define(id, deps, exp) {
		if (!exp) { exp = deps; deps = [ 'require', 'exports', 'module' ]; }
		var module = Module(undefined, id);
		module.children = deps.map(function(dep) { return Module(module, dep); });
		module.loaded = true;
		factories[id] = exp;
		waits[id].map(function(fn) { fn(module); });
	}
	define.bundle = function(id, bundle) {
		(bundles[id] = bundle).modules.map(function(m) { bundleMap[m] = bundleMap[m] || id; });
	};

	// there were modules shim defined before now.
	if (global.define) { global.define.d.map(function(args) { define.apply(undefined, args); }); }
	// make sure we map all of the bundles in the attribute
	for (var i in bundles) { define.bundle(i, bundles[i]); }

	function makeRequire(module) {
		var mrequire = function(id, fn) { return require(module, id, fn); };
		mrequire.resolve = function(id) { return resolve(module, id); };
		mrequire.cache = modules;
		mrequire.main = main;
		return mrequire;
	}

	function Module(parent, id) {
		if ('require' === id || 'exports' === id || 'module' === id) {
			return { id:id, loaded:true, exports:parent[id] || parent };
		}

		if (modules[(id = resolve(parent, id))]) { return modules[id]; }
		var uri = resolve({ id:path }, bundleMap[id] || id) + '.js',
			module = (modules[id] = { id:id, uri:uri, loaded:false });
		module.require = makeRequire(module);
		waits[id] = [];
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
				var ret = module.children.map(function(child) { return require(module, child.id); });
				if (ret = factories[id].apply(global, ret)) { module.exports = ret; }
			}
		}
		return module.exports;
	}

	function resolve(parent, id) {
		id = id.replace(/\.js$/i, '');
		if (!parent || !parent.id) { return id; }
		if (id.charAt(0) === '.') { id = parent.id.replace(/[^\/]+$/, id); }
		var terms = [];
		id.split('/').map(function(term) {
			if ('..' === term) { terms.pop(); }
			else if ('.' !== term) { terms.push(term); }
		});
		return terms.join('/');
	}

	function ensure(parent, ids, fn) {
		ids = [].concat(ids);
		var visited = {}, wait = 0;

		function done() {
			ids = ids.map(function(id) { return require(parent, id); });
			setTimeout(function() { fn.apply(global, ids); }, 13); // always async
		}
		function visit(module) {
			if (module.id in visited) { return; }
			return (visited[module.id] = module.loaded) ? module.children.map(visit) : load(module);
		}
		function load(module) {
			++wait;
			waits[module.id].push(function() {
				module.children.map(visit);
				if (--wait <= 0) { done(); }
			});
			if (doc.querySelector('script[src="' + module.uri + '"]')) { return; }
			var script = doc.createElement('script');
			script.src = module.uri;
			script.defer = true;
			return doc.querySelector('head').appendChild(script);
		}

		ids.map(function(id) { visit(Module(parent, id)); });
		if (wait <= 0) { done(); }
	}

	global.global = global; // for greater nodejs compat
	global.define = define;
	global.require = makeRequire(); // convenient, not necessary as modules have local version
}(this));
