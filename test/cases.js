var assert = require('test/assert').assert;
assert(global === this, '`this` must be an alias for `global`');
assert(typeof exports === 'object' && exports === module.exports, '`exports` must be an object and an alias of `module.exports`');
assert(require(module.id) === exports, '`require(module.id)` must return a reference to `exports`');

exports.foo = 'bar';
assert(require(module.id).foo === 'bar' && !require(module.id).bar, 'circular dependencies must return the `exports` so far');

exports = module.exports = { bar:'baz' };
assert(require(module.id) === exports && require(module.id).bar === 'baz', 'assigning to `module.exports` must work properly');

(function(){
	// `this` will be the global object, not the `module` object in here
	assert(this != module && typeof module === 'object', 'closure scope needs to maintain `module` variable');
	assert(typeof exports === 'object' && exports.bar === 'baz', 'closure scope needs to maintain `exports` variable');
	assert(typeof require === 'function' && require(module.id) === exports, 'closure scope needs to maintain `require` and `exports` variables');
})();

var result = require('./increment/all').incrementAll(1, 2, 3);
assert(result[0] === 2 && result[1] === 3 && result[2] === 4, 'relative identifiers must work in calls to `require`');

try { module.added = 'added'; } catch(e) {} // add variable to this module
assert(!Object.seal || !module.added, 'adding properties to `module` should fail (if Object.seal is defined)');

require('test/assert').report('client code');