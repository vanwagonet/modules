/**
 * Test the client-side define function
 **/
'use strict';

function defineJs() {
	var filename = require.resolve('../lib/define'),
		content = require('fs').readFileSync(filename);
	content += '\n//@ sourceURL=' + filename;
	return content;
}

function mockScript(atts) {
	return { src:atts.src,
		getAttribute:function(name) {
			return atts[name] || null;
		}
	};
}

function mockWindow() {
	var requireScript = mockScript({ src:'/modules/define.js', 'data-main':'main' }),
		window = {
			document:{
				// elements
				head:{},
				scripts:[ requireScript ],
				'require-script':requireScript,

				getElementById:function(id) {
					return ('object' === typeof this[id]) ? this[id] : null;
				},
				getElementsByTagName:function(tag) {
					if ('head' === tag) { return [ this.head ]; }
					if ('script' === tag) { return this.scripts; }
					return [];
				},
				querySelector:function(selector) {
					return null;
				}
			}
		};
	return window;
}

module.exports = {
	setUp: function(next) {
		this.window = mockWindow();
		Function(defineJs()).call(this.window);
		next();
	},

	tearDown: function(next) {
		this.window = null;
		next();
	},

	testPresence: function(test) {
		var window = this.window, define = window.define, require = window.require;

		test.expect(17);

		test.throws(function() { window.global = null; });
		test.strictEqual(window.global, window, 'Global object (window) is available as `global`.');

		test.throws(function() { window.define = null; }, '`define` should not be writable.');
		test.throws(function() { define.bundle = null; }, '`define.bundle` should not be writable.');
		test.strictEqual(typeof define, 'function', '`define` should be a global function.');
		test.strictEqual(typeof define.bundle, 'function', '`define.bundle` should be a function.');
		test.deepEqual(Object.keys(define).sort(), [ 'bundle' ].sort(),
			'`define` should have properties [ "bundle" ].');

		test.throws(function() { window.require = null; }, '`require` should not be writable.');
		test.throws(function() { require.resolve = null; }, '`require.resolve` should not be writable.');
		test.throws(function() { require.ensure = null; }, '`require.ensure` should not be writable.');
		test.throws(function() { require.cache = null; }, '`require.cache` should not be writable.');
	//	test.throws(function() { require.main = null; }, '`require.main` should not be writable.'); // Main is writeable until the first require call
		test.strictEqual(typeof require, 'function', '`require` should be a global function.');
		test.strictEqual(typeof require.resolve, 'function', '`require.resolve` should be a function.');
		test.strictEqual(typeof require.ensure, 'function', '`require.ensure` should be a function.');
		test.strictEqual(typeof require.cache, 'object', '`require.cache` should be an object.');
		test.strictEqual(typeof require.main, 'undefined', '`require.main` should be undefined initially.');
		test.deepEqual(Object.keys(require).sort(), [ 'resolve', 'ensure', 'cache', 'main' ].sort(),
			'`require` should have properties [ "resolve", "ensure", "cache", "main" ].');

		test.done();
	},

	testDefine: function(test) {
		var window = this.window, define = window.define, require = window.require;

	//	test.expect();

		var id = 'foo/bar', deps = [ 'baz' ], obj, factory = function() { return obj; };
		test.throws(function() { define(foo); }, '`define` must be called with an id.');

		define(id, obj = { foo:'foo' });
		test.strictEqual(require(id), obj, '`define` should accept an object as exports.');

		test.done();
	}
};

