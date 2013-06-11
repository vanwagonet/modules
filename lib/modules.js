/**
 * Provides wrapping of modules for use in the browser.
 **/
'use strict';

var fs = require('fs'), async = require('async'), extexp = /\.([^.\\\/]+)$/;

// turn a relative id to absolute given a parent id
function resolve(parent, id) {
	if (/^\.\.?\//.test(id) && parent) {
		id = parent.replace(/[^\/]+$/, id);
	}
	var terms = [];
	id.split('/').forEach(function(term) {
		if ('..' === term) { terms.pop(); }
		else if ('.' !== term) { terms.push(term); }
	});
	return terms.join('/');
}

// convert arbirary file to commonjs+return exports
function translate(id, filename, buffer, opts, next) {
	var ext = (filename.match(extexp) || { '1':'' })[1], encoding = opts.encoding || 'utf8',
		trans = opts.translate[filename] || opts.translate[id] || opts.translate[ext];
	if (trans) { return trans({ id:id, filename:filename, buffer:buffer }, opts, next); } // user configured translation

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
function wrap(id, filename, js, opts, next) {
	var nowrap = [ 'define', 'define.shim' ].concat(opts.nowrap);
	if (nowrap.some(function(no) { return no.test ? no.test(id) : (no === id); })) {
		return next(null, js); // no wrapping of these
	}
	var deps = exports.dependencies(id, js), params = [];
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

// convert module id to filename
function getFilename(id, opts, next) {
	var filename = opts.map[id] || id, f, ff = opts.forbid, forbid, forbidden;
	if ('function' === typeof filename) { filename = filename(id); }
	filename = require('path').resolve(opts.root, filename);

	function test(forbid) {
		return forbid.test ? forbid.test(filename) :
			(filename.slice(0, forbid.length) === forbid);
	}

	// mapped modules can be in forbidden places. (define, define.shim, and uris.json should be mapped)
	if (!opts.map[id]) {
		// anything below opts.root is forbidden
		if ('..' === require('path').relative(opts.root, filename).slice(0, 2) || opts.forbid.some(test)) {
			return next(new Error('Forbidden'), '');
		}
	}
	fs.stat(filename, function(err, stats) {
		if (err) { // not found without .js, try with
			return fs.exists(filename + '.js', function(exists) {
				return next(null, filename + (exists ? '.js' : ''));
			});
		}
		if (stats.isDirectory()) { // directories look for /index.js
			return fs.exists(filename + '/index.js', function(exists) {
				return next(null, filename + (exists ? '/index.js' : ''));
			});
		}
		return next(null, filename);
	});
}

// Adds the default options to the options passed in.
exports.getOptions = function getOptions(opts) {
	opts = opts || {};
	opts.root = opts.root || process.cwd();
	opts.path = opts.path || '/module/';
	opts.compress = opts.compress || false;
	opts.map = opts.map || {};
	opts.map.define = opts.map.define || __dirname + '/define.min';
	opts.map['define.shim'] = opts.map['define.shim'] || __dirname + '/define.shim';
	opts.translate = opts.translate || {};
	opts.forbid = (opts.forbid || []).map(function(p) {
		return p.test ? p : require('path').resolve(opts.root, p);
	});
	opts.nowrap = opts.nowrap || [ 'uris.json', /\.amd\.js$/i ];
	return opts;
};

// find all requires with string literal ids
exports.dependencies = function dependencies(id, js, absolute) {
	var reqexp = /\brequire\s*\(\s*(['"]).+?\1\s*\)/g,
		idexp = /(['"])(.+?)\1/,
		rid, aid, abs = [], rel = [],
		matches = js.match(reqexp),
		m, mm = matches && matches.length;
	for (m = 0; m < mm; ++m) {
		aid = resolve(id, rid = matches[m].match(idexp)[2]);
		if (abs.indexOf(aid) < 0) {
			abs.push(aid);
			rel.push(rid);
		}
	}
	return absolute ? abs : rel;
};

// Prints the code for the module, including define wrapper code necessary in the browser.
exports.module = function module(id, options, next) {
	if (id.slice(-3) === '.js') { id = id.slice(0, -3); }
	if (!next) { next = options; options = {}; }
	var opts = exports.getOptions(options), filename, stat;
	async.waterfall([
		function(next) { getFilename(id, opts, next); },
		function(muri, next) { fs.stat(filename = muri, next); },
		function(mstat, next) { stat = mstat; fs.readFile(filename, next); },
		function(buffer, next) { translate(id, filename, buffer, opts, next); },
		function(js, next) { wrap(id, filename, js, opts, next); },
		function(js, next) { return opts.compress ? opts.compress(js, next) : next(null, js); }
	], function(err, js) { next(err, js, stat && stat.mtime); });
};

// Prints the code for the modules, does not automatically include define.shim.
exports.modules = function modules(ids, options, next) {
	if (!next) { next = options; options = {}; }
	var opts = exports.getOptions(options), compress = opts.compress,
		modified = new Date(0);
	opts.compress = null; // don't compress each individually

	async.map(ids, function(id, next) {
		exports.module(id, opts, function(err, js, mod) {
			if (mod && mod > modified) { modified = mod; }
			next(err, js || '');
		});
	}, function(err, js) {
		if (err) { return next(err); }
		if (!compress) { return next(null, js.join(''), modified); }
		compress(js.join(''), function(err, js) { next(err, js, modified); });
	});
};

// Provides middleware to format module code for use in the browser.
exports.middleware = function middleware(options) {
	var opts = exports.getOptions(options || {}), basepath = opts.path;
	return function(req, res, next) {
		if (req.path.slice(0, basepath.length) !== basepath) { return next(); }
		function send(err, content, modified) {
			if (err) { return 'ENOENT' === err.code ? next() : next(err); }
			res.set('Content-Type', 'application/javascript');
			res.set('Last-Modified', modified.toGMTString());
			if (opts.maxAge) {
				res.set('Cache-Control', 'public, max-age=' + opts.maxAge);
			}
			res.send(content);
		}
		var id = req.path.slice(basepath.length);
		if (id.indexOf(',') < 0) { exports.module(id, opts, send); }
		else { exports.modules(id.split(/\s*,\s*/), opts, send); }
	};
};

