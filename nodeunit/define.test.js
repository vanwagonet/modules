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
				$selectors:{
					'[data-main]':requireScript
				},
				querySelector:function(selector) {
					var $sels = this.$selectors;
					return selector.split(',')
						.filter(function(s) { return s in $sels; })
						.map(function(s) { return $sels[s] })
						[0] || null;
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
		var window = this.window, define = window.define, wrequire = window.require;

		test.expect(10);

		test.strictEqual(window.global, window, 'Global object (window) is available as `global`.');

		test.strictEqual(typeof define, 'function', '`define` should be a global function.');
		test.strictEqual(typeof define.bundle, 'function', '`define.bundle` should be a function.');
		test.deepEqual(Object.keys(define).sort(), [ 'bundle' ].sort(),
			'`define` should have properties [ "bundle" ].');

		test.strictEqual(typeof wrequire, 'function', '`require` should be a global function.');
		test.strictEqual(typeof wrequire.resolve, 'function', '`require.resolve` should be a function.');
		test.strictEqual(typeof wrequire.ensure, 'function', '`require.ensure` should be a function.');
		test.strictEqual(typeof wrequire.cache, 'object', '`require.cache` should be an object.');
		test.strictEqual(typeof wrequire.main, 'object', '`require.main` should be an object, if @data-main was sepcified.');
		test.deepEqual(Object.keys(wrequire).sort(), [ 'resolve', 'ensure', 'cache', 'main' ].sort(),
			'`require` should have properties [ "resolve", "ensure", "cache", "main" ].');

		test.done();
	},

	testDefine: function(test) {
		var window = this.window, define = window.define, wrequire = window.require;

	//	test.expect();

		var id, deps = [ 'b', 'c' ], obj, factory = function() { return obj; };
		test.throws(function() { define(factory); }, '`define` must be called with an id.');

		define(id = 'id1', obj = { a:'a1' });
		test.equal(wrequire(id).a, 'a1', '`define` should accept an object as exports.');

		define(id = 'id2', factory); obj = { a:'a2' };
		test.equal(wrequire(id).a, 'a2', '`define` should delay evaluation until required.');

		define(id = 'id3', function(require, exports, module) { exports.a = 'a3'; });
		test.equal(wrequire(id).a, 'a3', '`define` should understand `exports`.');

		define(id = 'id4', function(require, exports, module) { module.exports = { a:'a4' }; });
		test.equal(wrequire(id).a, 'a4', '`define` should understand `module.exports`.');

		test.done();
	}
};

