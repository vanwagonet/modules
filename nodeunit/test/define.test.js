/**
 * Test the client-side define function
 **/
'use strict';

var browser = ('undefined' !== typeof window && this === window);

function objectKeys(obj) {
	var keys = [], k;
	for (k in obj) { if (keys.hasOwnProperty.call(obj, k)) { keys.push(k); } }
	return keys;
}


function addScript(window, atts, next) {
	var script = window.document.createElement('script'), a,
		head = window.document.getElementsByTagName('head')[0],
		prop = { src:1, id:1, defer:1, async:1 };
	for (a in atts) {
		if (prop[a] || /^on/.test(a)) { script[a] = atts[a]; }
		else { script.setAttribute(a, atts[a]); }
	}
	script.onload = script.onerror = script.onreadystatechange = function() {
		if ('loading' === script.readyState) { return; }
		script.onload = script.onerror = script.onreadystatechange = null;
		next(null, script);
	};
	return head.appendChild(script);
}


function defineJs(window, atts, next) {
	var script = window.define_script;
	if (script) { script.parentNode.removeChild(script); }
	atts.src = 'define.js';
	atts.id = atts.id || 'require-script';
	atts['data-main'] = atts['data-main'] || '';
	addScript(window, atts, function(err, script) {
		next(err, window.define_script = script);
	});
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
			defineJs(env.window = window, {}, next);
		});
	},

	tearDown: function(next) {
		this.window = null;
		next();
	},

	testPresence: function(test) {
		var window = this.window, define = window.define, req = window.require;

		test.expect(11);

		test.equal(window.global, window, 'Global object (window) is available as `global`.');

		test.strictEqual(typeof define, 'function', '`define` should be a global function.');
		test.strictEqual(typeof define.amd, 'object', '`define.amd` should be an object.');
		test.strictEqual(typeof define.uri, 'function', '`define.uri` should be a function.');
		test.deepEqual(objectKeys(define).sort(), [ 'amd', 'uri' ].sort(),
			'`define` should have properties [ "amd", "uri" ].');

		test.strictEqual(typeof req, 'function', '`require` should be a global function.');
		test.strictEqual(typeof req.resolve, 'function', '`require.resolve` should be a function.');
		test.strictEqual(typeof req.toUrl, 'function', '`require.toUrl` should be a function.');
		test.strictEqual(typeof req.cache, 'object', '`require.cache` should be an object.');
		test.strictEqual(typeof req.main, 'undefined', '`require.main` should be undefined, if @data-main was empty.');
		test.deepEqual(objectKeys(req).sort(), [ 'cache', 'main', 'resolve', 'toUrl' ].sort(),
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
		this.window.require('test/commonjs/client', function(client) { client.run(test); });
	},

	testAMDJS: function(test) {
		var env = this, prefix = 'test/amdjs/', t = 0, tests = [
			'basic_circular', 'basic_define', 'basic_empty_deps', 'basic_no_deps', 'basic_require', 'basic_simple'
		];
		(function loop() {
			var path = prefix + tests[t++] + '/';
			mockWindow(function(err, window) {
				if (err) { return test.done(err); }
				defineJs(env.window = window, { 'data-path':path }, function(err) {
					if (err) { return test.done(err); }
					window.test = test;
					window.go = function(deps, factory) {
						window.define('_test', deps, factory);
					};
					window.amdJSPrint = function(msg, type) {
						if ('done' === type) {
							if (t < tests.length) { loop(); }
							else { test.done(); }
						}
						if ('done' === type || 'info' === type) { return; }
						test.ok('pass' === type, msg.replace(/^PASS\s|^FAIL\s/, ''));
					};
					window.require('_test', function(){});
				});
			});
		}());
	}
};

