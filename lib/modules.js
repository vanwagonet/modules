/**
 * Provides wrapping of modules for use in the browser.
 **/
'use strict';

var fs = require('fs'), Path = require('path'),
	async = require('async'), extexp = /\.([^.\\\/])$/;

function getOptions(opts) {
	opts = opts || {};
	opts.root = opts.root || __dirname;
	opts.path = opts.path || '/module/';
	opts.maxAge = opts.maxAge || 0;
	opts.compress = opts.compress || false;
	opts.bundles = opts.bundles || false;
	opts.map = opts.map || {};
	opts.map.define = opts.map.define || __dirname + '/define.min';
	opts.map['define.shim'] = opts.map['define.shim'] || __dirname + '/define.shim';
	opts.translate = opts.translate || {};
	opts.forbid = (opts.forbid || []).map(function(p) {
		return Path.resolve(opts.root, p);
	});
	opts.nowrap = opts.nowrap || [ 'uris.json', /\.amd\.js$/i ];
	return opts;
} exports.getOptions = getOptions;

function resolve(parent, id) {
	if (id.charAt(0) === '.' && parent) {
		id = parent.replace(/[^\/]+$/, id);
	}
	var terms = [];
	id.split('/').map(function(term) {
		if ('..' === term) { terms.pop(); }
		else if ('.' !== term) { terms.push(term); }
	});
	return terms.join('/');
}

// find all requires with string literal ids
function getRequiredIds(id, js) {
	var reqexp = /\brequire\s*\(\s*(['"]).+?\1\s*\)/g,
		idexp = /(['"])(.+?)\1/,
		rid, list = [],
		matches = js.match(reqexp),
		m, mm = matches && matches.length;
	for (m = 0; m < mm; ++m) {
		rid = resolve(id, matches[m].match(idexp)[2]);
		if (list.indexOf(rid) < 0) { list.push(rid); }
	}
	return list;
}

// convert arbirary file to commonjs+return exports
function translate(id, path, buffer, opts, next) {
	var ext = path.match(extexp)[1], encoding = opts.encoding || 'utf8',
		trans = opts.translate[path] || opts.translate[id] || opts.translate[ext];
	if (trans) { return trans(id, path, buffer, opts, next); } // user configured translation

	var string = buffer.toString(encoding);
	if ('uris.json' === id) { // expand uris file to full explicit lists
		return exports.expandUris(JSON.parse(string), opts, function(err, list) {
			if (err) { return next(err); }
			next(null, JSON.stringify(list) + '.forEach(define.uri);\n');
		});
	}
	if ('js' === ext) { return next(null, string); }
	if ('json' === ext) { return next(null, 'return ' + string); }
	return 'return ' + JSON.stringify(string); // export file as json string
}

// convert commonjs to amd
function wrap(id, path, js, opts, next) {
	var nowrap = [ 'define', 'define.shim' ].concat(opts.nowrap);
	if (nowrap.some(function(no) { return no.test ? no.test(id) : (no === id); })) {
		return next(null, js); // no wrapping of these
	}
	var deps = getRequiredIds(id, js), params = [];
	// make sure require, exports, and module are properly passed into the factory
	if (/\brequire\b/.test(js)) { params.push('require'); }
	if (/\bexports\b/.test(js)) { params.push('exports'); }
	if (/\bmodule\b/.test(js)) { params.push('module'); }
	deps = params.concat(deps);
	js = 'define(' + JSON.stringify(id) +
			',' + JSON.stringify(deps) +
			',function(' + params + ')' +
			'{' + js + '\n}' +
		');\n';
	next(null, js);
}

// convert module id to file path
function getPath(id, opts, next) {
	var path = opts.map[id] || id, f, ff = opts.forbid, forbid, forbidden;
	path = Path.resolve(opts.root, path);

	function test(forbid) {
		return forbid.test ? forbid.test(path) :
			(path.slice(0, forbid.length) === forbid);
	}

	// mapped modules can be in forbidden places. (define, define.shim, and uris.json should be mapped)
	if (!opts.map[id]) {
		// anything below opts.root is forbidden
		if ('..' === Path.relative(opts.root, path).slice(0, 2) || opts.forbid.some(test)) {
			return next(new Error('Forbidden'), '');
		}
	}
	fs.stat(path, function(err, stats) {
		if (err) { // not found without .js, try with
			return fs.exists(path + '.js', function(exists) {
				return next(null, path + (exists ? '.js' : ''));
			});
		}
		if (stats.isDirectory()) { // directories look for /index.js
			return fs.exists(path + '/index.js', function(exists) {
				return next(null, path + (exists ? '/index.js' : ''));
			});
		}
		return next(null, path);
	});
}

// expand module list to include all deep dependencies, except modules in dependency files 
exports.expandUris = function(uris, options, next) {
	if (!next) { next = options; options = {}; }
	var opts = getOptions(options), requires = {};

	// deep copy to avoid mangling original object
	uris = uris.map(function(file) {
		requires[file.uri] = (file.requires || []).slice();
		return { uri:file.uri, ids:file.ids.slice() };
	});

	function expand(file, prop, next) {
		exports.dependencies(file[prop] || [], true, opts, function(err, ids) {
			next(err, file[prop] = ids);
		});
	}

	async.each(uris, function(file, next) {
		async.parallel([
			expand.bind(null, file, 'ids'),
			expand.bind(null, requires, file.uri)
		], next);
	}, function(err) {
		if (err) { return next(err); }
		uris.forEach(function(file, next) {
			file.ids = file.ids.filter(function(id) {
				return requires[file.uri].indexOf(id) < 0;
			});
		});
		next(null, uris);
	});
};

// Prints the code for the module, including boilerplate code necessary in the browser.
exports.module = function module(id, options, next) {
	if (id.slice(-3) === '.js') { id = id.slice(0, -3); }
	if (!next) { next = options; options = {}; }
	var opts = getOptions(options), path, stat;
	async.waterfall([
		function(next) { getPath(id, opts, next); },
		function(muri, next) { fs.stat(path = muri, next); },
		function(mstat, next) { stat = mstat; fs.readFile(path, next); },
		function(buffer, next) { translate(id, path, buffer, opts, next); },
		function(js, next) { wrap(id, path, js, opts, next); },
		function(js, next) { return opts.compress ? opts.compress(js, next) : next(null, js); }
	], function(err, js) { next(err, js, stat && stat.mtime); });
};

// Prints the code for the modules, including boilerplate code necessary in the browser.
exports.modules = function modules(ids, options, next) {
	if (!next) { next = options; options = {}; }
	var opts = getOptions(options), compress = opts.compress,
		modified = new Date(0), js = '';
	opts.compress = null; // don't compress each individually

	function append(next, err, code, mod) {
		if (mod && mod > modified) { modified = mod; }
		next(err, js += code || '');
	}

	async.series([
		function(next) { // make sure at least the shim is in each bundle
			if ([ 'define', 'define.shim' ].indexOf(ids[0]) >= 0) { return next(); }
			exports.module('define.shim', opts, append.bind(null, next));
		},
		function(next) {
			async.each(ids, function(id, next) {
				exports.module(id, opts, append.bind(null, next));
			}, next);
		},
		function(next) {
			if (!compress) { return next(); }
			compress(js, function(err, cjs) { next(err, js = cjs); });
		}
	], function(err) { next(err, js, modified); });
};

exports.requiredCache = {};

// Finds all the modules' nested dependencies and provides the ids as an array
//  id can be a string or an array of absolute module ids
exports.dependencies = function dependencies(ids, deep, options, next) {
	if (!next) { next = options;
		if ('object' === typeof deep) { options = deep; deep = false; }
		else { options = {}; }
	}
	var opts = getOptions(options),
		stack = [].concat(ids), list = [].concat(ids);
	opts.compress = false;
	opts.nowrap.unshift(/./);
	function visit(rid) {
		if (list.indexOf(rid) >= 0) { return; }
		list.push(rid);
		if (deep) { stack.push(rid); }
	}
	(function loop() {
		if (!stack.length) { return next(null, list); }
		var id = stack.pop(), rlist = exports.requiredCache[id];
		if (rlist) {
			rlist.forEach(visit);
			return loop();
		}
		exports.module(id, opts, function(err, js, mtime) {
			var rlist = getRequiredIds(id, js);
			exports.requiredCache[id] = rlist;
			rlist.forEach(visit);
			return loop();
		});
	}());
};

// Provides middleware to format module code for use in the browser.
exports.middleware = function middleware(options) {
	var opts = getOptions(options || {}), path = opts.path;
	return function(req, res, next) {
		if (req.path.slice(0, path.length) !== path) { return next(); }
		exports.modules(
			req.path.slice(path.length), opts,
			function(err, content, modified) {
				if (err) { return 'ENOENT' === err.code ? next() : next(err); }
				res.set('Content-Type', 'application/javascript');
				res.set('Last-Modified', modified.toGMTString());
				res.set('Cache-Control', 'public, max-age=' + opts.maxAge);
				res.send(content);
			}
		);
	};
};

