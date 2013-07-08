(function(global, undefined) {
	var doc = global.document, modules = {}, waits = {}, factories = {}, div,
		main = doc.getElementById('modules-define') || doc.querySelector('script[data-main]'),
		path = main ? (main.getAttribute('data-path') || main.src) : '', uris = {};

	function map(fn, arr) {
		for (var arr2 = [], a = 0, aa = arr.length; a < aa; ++a) { arr2[a] = fn(arr[a]); }
		return arr2;
	}

	function fireWaits(module) {
		map(function(fn) { fn(module); }, waits[module.id]);
		waits[module.id] = [];
	}

	div = doc.createElement('div');
	div.innerHTML = '<a></a>';
	function canonicalize(url) {
		div.firstChild.href = url; // Ensures that the href is properly escaped
		if (!div.addEventListener) {
			div.innerHTML = div.innerHTML; // Run the current innerHTML back through the parser
		}
		return div.firstChild.href;
	}

	function define(id, deps, exp) {
		if (!exp) { exp = deps; deps = [ 'require', 'exports', 'module' ]; }
		var module = getModule(undefined, id);
		module.children = map(function(dep) { return getModule(module, dep); }, deps);
		module.loaded = true;
		factories[id] = exp;
		fireWaits(module);
	}

	// this define function is AMD compatible
	define.amd = {};

	// if there were modules shim defined before now, really define them now
	if (global.define && global.define.amd) {
		if (!global.define.amd.d) { return; } // bail if not define.shim
		else { map(function(args) { define.apply(undefined, args); }, global.define.amd.d); }
	}

	// allow mapping uris for modules, make sure we map all of the uris in the attribute
	map(define.uri = function(mp) { map(function(id) { uris[id] = uris[id] || mp.uri; }, mp.ids); },
		global.JSON && JSON.parse(main ? main.getAttribute('data-uris') : '[]') || []);

	// if there is a main module, require it when the page is ready
	function run() { require(undefined, main.id, function(){}); }
	if ((main = main && main.getAttribute('data-main') || undefined)) {
		(main = getModule(undefined, main)).require.main = main;
		if ('loading' !== doc.readyState) { setTimeout(run, 13); }
		else if (doc.addEventListener) {
			doc.addEventListener('DOMContentLoaded', run, false);
			global.addEventListener('load', run, false);
		} else if (global.attachEvent) {
			global.attachEvent('onload', run);
		}
	}

	function makeRequire(module) {
		var mrequire = function(id, fn) { return require(module, id, fn); };
		mrequire.resolve = function(id) { return getModule(module, id).uri; };
		mrequire.toUrl = function(id) {
			return getModule(module, id.replace(/\.[^.\\\/]+$/, ''))
				.uri.replace(/\.js$/i, id.match(/\.[^.\\\/]+$/));
		};
		mrequire.cache = modules;
		mrequire.main = main;
		return mrequire;
	}

	function getModule(parent, id) {
		if ('require' === id || 'exports' === id || 'module' === id) {
			return { id:id, loaded:true, exports:parent[id] || parent, children:[] };
		}

		id = resolve(parent, id).replace(/\.js$/i, '');
		if (modules[id]) { return modules[id]; }
		var uri = canonicalize(uris[id] ? uris[id] : path.replace(/[^\/]*$/, id + '.js')),
			module = (modules[id] = { id:id, filename:uri, uri:uri, loaded:false, children:[] });
		module.require = makeRequire(module);
		waits[id] = [];
		return module;
	}

	function require(parent, id, fn) {
		if (fn) { return ensure(parent, id, fn); }
		var module = getModule(parent, id);
		if (!module.loaded) { throw new Error(id + ' not found'); }
		if (!('exports' in module)) {
			module.parent = parent; // first module to actually require this one is parent

			// if define was passed a non-function, just assign it to exports
			if ('function' !== typeof factories[id = module.id]) { module.exports = factories[id]; }
			else {
				module.exports = {};
				fn = map(function(child) { return require(module, child.id); },
						module.children.slice(0, factories[id].length)); // don't require prematurely on wrapped commonjs
				if ((fn = factories[id].apply(global, fn))) { module.exports = fn; }
			}
		}
		return module.exports;
	}

	function resolve(parent, id) {
		if (/^\.\.?\//.test(id) && parent && parent.id) {
			id = parent.id.replace(/[^\/]+$/, id);
		}
		var terms = [];
		map(function(term) {
			if ('..' === term) { terms.pop(); }
			else if ('.' !== term) { terms.push(term); }
		}, id.split('/'));
		return terms.join('/');
	}

	function ensure(parent, ids, fn) {
		ids = ids.splice ? ids : [ ids ];
		var visited = {}, wait = 0;

		function done() {
			if (fn) { fn.apply(global, map(function(id) { return require(parent, id); }, ids)); }
			fn = null;
		}
		function visit(module) {
			if (module.id in visited) { return; }
			return (visited[module.id] = module.loaded) ? map(visit, module.children) : load(module);
		}
		function load(module) {
			++wait;
			waits[module.id].push(function() {
				map(visit, module.children);
				if (--wait <= 0) { setTimeout(done, 13); }
			});

			var script;
			map(function(node) {
				if (canonicalize(node.src) === module.uri) { script = node; }
			}, doc.getElementsByTagName('script'));

			if (!script) {
				script = doc.createElement('script');
				script.onload = script.onerror = script.onreadystatechange = function() {
					if ('loading' === script.readyState) { return; }
					script.onload = script.onerror = script.onreadystatechange = null;
					fireWaits(module);
				};
				script.defer = true;
				script.src = module.uri;
				doc.getElementsByTagName('head')[0].appendChild(script);
			}
		}

		map(function(id) { visit(getModule(parent, id)); }, ids);
		if (wait <= 0) { setTimeout(done, 13); } // always async
	}

	global.global = global; // for greater nodejs compat
	global.define = define;
	global.require = makeRequire();
}(this));

