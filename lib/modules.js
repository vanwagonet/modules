/**
 * Provides wrapping of modules for use in the browser.
 **/
'use strict';

var fs = require('fs'), async = require('async'), extexp = /\.([^.\\\/]+)$/;

// The default options used
exports.defaults = {
	encoding: 'utf8',
	nowrap: [ 'uris.json', /\.amd\.js$/i ],
	path: '/module/',
	root: process.cwd()
};

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
function translate(id, filename, buffer, options, next) {
	var ext = (filename.match(extexp) || { '1':'' })[1],
		encoding = options.encoding || exports.defaults.encoding,
		trans = options.translate;
	trans = trans && (trans[filename] || trans[id] || trans[ext]);
	if (trans) { return trans({ id:id, filename:filename, buffer:buffer }, options, next); } // user configured translation

	var string = buffer.toString(encoding);
	if ('js' === ext) { return next(null, string); }
	if ('json' === ext) { return next(null, 'return ' + string); }
	return next(null, 'return ' + JSON.stringify(string)); // export file as json string
}

// convert commonjs to amd
function wrap(id, filename, js, options, next) {
	var nowrap = [ 'define', 'define.shim' ].concat(options.nowrap || exports.defaults.nowrap);
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
function getFilename(id, options, next) {
	var Path = require('path'),
		root = options.root || exports.defaults.root,
		map = options.map || {},
		forbid = (options.forbid || []).map(function(forbid) {
			return forbid.test ? forbid : Path.resolve(root, forbid);
		}),
		filename = map[id] || id;
	if ('function' === typeof filename) { filename = filename(id, options); }
	filename = Path.resolve(root, filename);

	function test(forbid) {
		return forbid.test ? forbid.test(filename) :
			(filename.slice(0, forbid.length) === forbid); // filename starts with forbid
	}

	// mapped modules can be in forbidden places. (define, define.shim, and uris.json should be mapped)
	map.define = map.define || Path.resolve(__dirname, 'define.min');
	map['define.shim'] = map['define.shim'] || Path.resolve(__dirname, 'define.shim');
	if (!map[id]) {
		// anything below options.root is forbidden
		if ('..' === Path.relative(root, filename).slice(0, 2) || forbid.some(test)) {
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
	var filename, stat;
	async.waterfall([
		function(next) { getFilename(id, options, next); },
		function(muri, next) { fs.stat(filename = muri, next); },
		function(mstat, next) { stat = mstat; fs.readFile(filename, next); },
		function(buffer, next) { translate(id, filename, buffer, options, next); },
		function(js, next) { wrap(id, filename, js, options, next); },
		function(js, next) { return options.compress ? options.compress(js, next) : next(null, js); }
	], function(err, js) { next(err, err ? null : { code:js, modified:(stat && stat.mtime) }); });
};

// Prints the code for the modules, does not automatically include define.shim.
exports.modules = function modules(ids, options, next) {
	if (!next) { next = options; options = {}; }
	var compress = options.compress, modified;
	options.compress = null; // don't compress each individually

	async.map(ids, function(id, next) {
		exports.module(id, options, function(err, result) {
			if (result && (!modified || result.modified > modified)) { modified = result.modified; }
			next(err, result && result.code || '');
		});
	}, function(err, js) {
		if (err) { return next(err); }
		if (!compress) { return next(null, { code:js.join(''), modified:modified }); }
		compress(js.join(''), function(err, js) {
			next(err, err ? null : { code:js, modified:modified });
		});
	});
};

// Provides middleware to format module code for use in the browser.
exports.middleware = function middleware(options) {
	var basepath = options.path || exports.defaults.path;
	return function(req, res, next) {
		if (req.path.slice(0, basepath.length) !== basepath) { return next(); }
		function send(err, content, modified) {
			if (err) { return 'ENOENT' === err.code ? next() : next(err); }
			res.set('Content-Type', 'application/javascript');
			res.set('Last-Modified', modified.toGMTString());
			if (options.maxAge) {
				res.set('Cache-Control', 'public, max-age=' + options.maxAge);
			}
			res.send(content);
		}
		var id = req.path.slice(basepath.length);
		if (id.indexOf(',') < 0) { exports.module(id, options, send); }
		else { exports.modules(id.split(/\s*,\s*/), options, send); }
	};
};

