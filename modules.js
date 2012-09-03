/**
 * Provides wrapping of modules for use in the browser.
 **/
"use strict";

var fs = require('fs'), path = require('path'), extexp = /\.(\w+)$/,
	wrapper = 'define({id},function(require,exports,module){{content}\n});\n';

function translate(name, uri, content, opts) {
	var ext = uri.match(extexp)[1];
	if (opts.translate[ext]) return opts.translate[ext](name, uri, content, opts);
	if ('js' === ext) return content;
	if ('json' === ext) return 'module.exports = ' + content;
	return 'module.exports = ' + JSON.stringify(content); // export file as json string
}

function getUri(id, opts) {
	var uri = opts.map[id] || id, f, ff = opts.forbid, forbid;
	uri = path.resolve(opts.root, uri) + (extexp.test(uri) ? '' : '.js');
	for (f = 0; f < ff; ++f) {
		forbid = opts.forbid[f];
		if (uri.slice(0, forbid.length) === forbid) return '';
	}
	return uri;
}

function getOptions(opts) {
	opts = opts || {};
	opts.root = opts.root || __dirname;
	opts.path = opts.path || '/module/';
	opts.maxAge = opts.maxAge || 0;
	opts.compress = opts.compress || false;
	opts.map = opts.map || {};
	opts.map.require = opts.map.require || __dirname + '/require';
	opts.translate = opts.translate || {};
	opts.forbid = (opts.forbid || []).map(function(p) {
		return path.resolve(opts.root, p);
	});
	return opts;
}

/**
 * Prints the code for the module, including boilerplate code necessary in the browser.
 **/
function module(id, opts, next) {
	if (id.slice(-3) === '.js') id = id.slice(0, -3);
	opts = getOptions(opts);
	var uri = getUri(id, opts);
	fs.stat(uri, function(err, stat) {
		if (err) return next(err);
		fs.readFile(uri, 'utf8', function(err, content) {
			if (err) return next(err);
			if (id !== 'require') {
				content = translate(id, uri, content, opts);
				content = wrapper
					.replace('{id}', JSON.stringify(id))
					.replace('{content}', content);
			}
			if (opts.compress) {
				opts.compress(content, function(err, content) {
					if (err) return next(err);
					next(null, content, stat.mtime);
				});
			} else {
				next(null, content, stat.mtime);
			}
		});
	});
}

/**
 * Prints the code for the modules, including boilerplate code necessary in the browser.
 **/
function modules(modules, opts, next) {
	var modified = new Date(0), error,
		length = modules.length, m = 0,
		out = '';

	opts = getOptions(opts);
	var compressfn = opts.compress;
	opts.compress = null; // don't compress each individually

	function loop() { // append each module
		if (m < length) return module(modules[m++], opts, append);
		if (!compressfn) return next(null, out, modified);
		compressfn(out, function(err, out) {
			if (err) return next(err);
			next(null, out, modified);
		});
	}

	function append(err, content, mod) {
		if (err) return next(err);
		out += content;
		if (mod > modified) modified = mod;
		loop();
	}

	if ('require' !== modules[0]) {
		out += // allow this package to be before require.js
			'if (!this.define) { this.define = (function() {\n' +
			'	function define(id, fn) { defs[id] = fn; }\n' +
			'	var defs = define.defs = {};\n' +
			'	return define;\n' +
			'}()); }\n\n';
	}
	loop();
}

/**
 * Finds all the module's nested dependencies and provides the ids as an array
 *  id can be a string or an array of absolute module id strings
 **/
function dependencies(id, opts, next) {
	opts = getOptions(opts);
	var stack = [].concat(id), list = [].concat(id),
		reqexp = /\brequire\s*\(\s*(['"]).+?\1\s*\)/g,
		idexp = /(['"])(.+?)\1/, ext = '.js';

	function resolve(id, base) {
		if (id.slice(-ext.length) === ext) { id = id.slice(0, -ext.length); }
		if (id.charAt(0) === '.') { id = base.replace(/\w+$/, id); }
		var orig = id.split('/'), terms = [], i, l = orig.length;
		for (i = 0; i < l; ++i) {
			if (orig[i] === '..') { terms.pop(); }
			else if (orig[i] !== '.') { terms[terms.length] = orig[i]; }
		}
		return terms.join('/');
	}

	function loop() {
		if (!stack.length) return next(null, list);
		var id = stack.pop(), uri = getUri(id, opts);
		fs.readFile(uri, 'utf8', function(err, content) {
			if (err) return ('ENOENT' === err.code) ? loop() : next(err);
			content = translate(id, uri, content, opts);
			var matches = content.match(reqexp),
				m, mm = matches && matches.length;
			for (m = 0; m < mm; ++m) {
				var rid = resolve(matches[m].match(idexp)[2], id);
				if (!~list.indexOf(rid)) {
					list[list.length] = stack[stack.length] = rid;
				}
			}
			loop();
		});
	}
	loop();
}

/**
 * Provides middleware to format module code for use in the browser.
 **/
function middleware(opts) {
	opts = getOptions(opts);
	var path = opts.path, deps = /\/dependencies\.json$/i;

	return function(req, res, next) {
		if (req.path.slice(0, path.length) !== path) return next();
		var id = req.path.slice(path.length);

		if (deps.test(id)) {
			dependencies(id.replace(deps, ''), opts, function(err, content) {
				if (err) return 'ENOENT' === err.code ? next() : next(err);
				res.set('Content-Type', 'application/json');
				res.set('Cache-Control', 'public, max-age=' + opts.maxAge);
				res.send(content);
			});
		} else {
			module(id, opts, function(err, content, modified) {
				if (err) return 'ENOENT' === err.code ? next() : next(err);
				res.set('Content-Type', 'application/javascript');
				res.set('Last-Modified', modified.toGMTString());
				res.set('Cache-Control', 'public, max-age=' + opts.maxAge);
				res.send(content);
			});
		}
	};
}

exports.middleware = middleware;
exports.dependencies = dependencies;
exports.modules = modules;
exports.module = module;
exports.getOptions = getOptions;

