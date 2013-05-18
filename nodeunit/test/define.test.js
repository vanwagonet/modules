/**
 * Test the client-side define function
 **/
'use strict';

var browser = ('undefined' !== typeof window && this === window);


function defineJs(window, next) {
	var head = window.document.querySelector('head'),
		script = head.querySelector('script[data-main]');
	if (script) { head.removeChild(script); }
	script = window.document.createElement('script');
	script.src = 'define.min.js';
	script.setAttribute('data-main', '');
	script.onload = function() { next(); };
	head.appendChild(script);
}


var mockWindow = browser ?
function(next) {
	// remove previous implementation
	window.global = undefined;
	window.define = undefined;
	window.require = undefined;
	next(null, window);
}:
function(next) {
	var jsdom = require('jsdom'),
		file = require.resolve('../empty.html');
	jsdom.env({
		html: require('fs').readFileSync(file),
		url: 'file://' + file,
		done: next,
		features: {
            FetchExternalResources: [ 'script' ],
            ProcessExternalResources: [ 'script' ],
            MutationEvents: '2.0'
        }
	});
};


module.exports = {
	setUp: function(next) {
		var env = this;
		mockWindow(function(err, window) {
			if (err) { return next(err); }
			defineJs(env.window = window, next);
		});
	},

	tearDown: function(next) {
		this.window = null;
		next();
	},

	testPresence: function(test) {
		var window = this.window, define = window.define, req = window.require;

		test.expect(11);

		test.strictEqual(window.global, window, 'Global object (window) is available as `global`.');

		test.strictEqual(typeof define, 'function', '`define` should be a global function.');
		test.strictEqual(typeof define.amd, 'object', '`define.amd` should be an object.');
		test.strictEqual(typeof define.uri, 'function', '`define.uri` should be a function.');
		test.deepEqual(Object.keys(define).sort(), [ 'amd', 'uri' ].sort(),
			'`define` should have properties [ "amd", "uri" ].');

		test.strictEqual(typeof req, 'function', '`require` should be a global function.');
		test.strictEqual(typeof req.resolve, 'function', '`require.resolve` should be a function.');
		test.strictEqual(typeof req.toUrl, 'function', '`require.toUrl` should be a function.');
		test.strictEqual(typeof req.cache, 'object', '`require.cache` should be an object.');
		test.strictEqual(typeof req.main, 'undefined', '`require.main` should be undefined, if @data-main was empty.');
		test.deepEqual(Object.keys(req).sort(), [ 'cache', 'main', 'resolve', 'toUrl' ].sort(),
			'`require` should have properties [ "cache", "main", "resolve", "toUrl" ].');

		test.done();
	},

	testDefine: function(test) {
		var window = this.window, define = window.define, req = window.require;

		test.expect(5);

		var id, deps = [ 'b', 'c' ], obj, factory = function() { return obj; };
		test.throws(function() { define(factory); }, '`define` must be called with an id.');

		define(id = 'id1', obj = { a:'a1' });
		test.equal(req(id).a, 'a1', '`define` should accept an object as exports.');

		define(id = 'id2', factory); obj = { a:'a2' };
		test.equal(req(id).a, 'a2', '`define` should delay evaluation until required.');

		define(id = 'id3', function(require, exports, module) { exports.a = 'a3'; });
		test.equal(req(id).a, 'a3', '`define` should understand `exports`.');

		define(id = 'id4', function(require, exports, module) { module.exports = { a:'a4' }; });
		test.equal(req(id).a, 'a4', '`define` should understand `module.exports`.');

		test.done();
	},

	testCommonJS: function(test) {
		var window = this.window, define = window.define, req = window.require;

		test.expect(15);


		define('test/absolute/b', function(require, exports, module) { exports.foo = function() {}; });
		define('test/absolute/submodule/a', function(require, exports, module) { exports.foo = function() { return require('test/absolute/b'); }; });
		define('test/absolute/program', function(require, exports, module) {
			var a = require('test/absolute/submodule/a'), b = require('test/absolute/b');
			test.strictEqual(a.foo().foo, b.foo, '`require` works with absolute identifiers.');
		});
		req('test/absolute/program');


		define('test/cyclic/a', function(require, exports, module) { var b = require('./b'); exports.a = function() { return b; }; });
		define('test/cyclic/b', function(require, exports, module) { var a = require('./a'); exports.b = function() { return a; }; });
		define('test/cyclic/program', function(require, exports, module) {
			var a = require('./a'), b = require('./b');
			test.strictEqual(a.a().b, b.b, 'a gets b');
			test.strictEqual(b.b().a, a.a, 'b gets a');
			exports.a = a;
			test.ok(require(module.id).a && !require(module.id).b, 'partial export available');
			exports.b = b;
			test.ok(require(module.id).a && require(module.id).b, 'export is updated properly');
		});
		req('test/cyclic/program');


		define('test/determinism/a', function(require, exports, module) {
			test.throws(function() { require('a'); }, 'require does not fall back to relative modules when absolutes are not available.');
		});
		define('test/determinism/program', function(require, exports, module) { require('./a'); });
		req('test/determinism/program');


		define('test/exactExports/a', function(require, exports, module) { exports.program = function() { return require('./program'); }; });
		define('test/exactExports/program', function(require, exports, module) {
			test.strictEqual(require('./a').program(), exports, 'exact exports');
		});
		req('test/exactExports/program');


		define('test/method/a', function(require, exports, module) {
			exports.foo = function() { return this; };
			exports.set = function(x) { this.x = x; };
			exports.get = function() { return this.x; };
			exports.getClosed = function() { return exports.x; };
		});
		define('test/method/program', function(require, exports, module) {
			var a = require('./a'), foo = a.foo;
			test.strictEqual(a.foo(), a, 'calling a module member');
			test.strictEqual(foo(), (function() { return this; }()), 'members not implicitly bound');
			a.set(10);
			test.strictEqual(a.get(), 10, 'get and set');
		});
		req('test/method/program');


		define('test/missing/program', function(require, exports, module) {
			test.throws(function() { require('bogus'); }, '`require` throws error when module missing');
		});
		req('test/method/program');


		define('test/transitive/a', function(require, exports, module) { exports.foo = require('./b').foo; });
		define('test/transitive/b', function(require, exports, module) { exports.foo = require('./c').foo; });
		define('test/transitive/c', function(require, exports, module) { exports.foo = function() { return 1; }; });
		define('test/transitive/program', function(require, exports, module) {
			test.strictEqual(require('./a').foo(), 1, 'transitive');
		});
		req('test/transitive/program');


		define('test/variables/program', function(require, exports, module) {
			test.strictEqual(window.global, this, 'global aliases this');
			test.ok('object' === typeof exports && exports === module.exports, '`exports` aliases `module.exports`.');
			test.strictEqual(require(module.id), exports, '`require(module.id)` returns exports.');

			exports = module.exports = { bar:'baz' };
			test.ok(require(module.id) === exports && 'baz' === require(module.id).bar, 'assign to `module.exports`.');
		});
		req('test/variables/program');


		test.done();
	}
};

