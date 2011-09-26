(function(){
	var global = (this.global = this), last = /\w+$/, ext = '.js',
		modules = {}, defs = {}, stack = [],
		readOnly = { writable:false, configurable:false, enumerable:true },
		props = { id:readOnly, require:readOnly };

	function require(oid) {
		var id = resolve(oid);
		if (!defs[id]) { throw new Error('Module "'+oid+'" was not found.'); }
		if (!modules[id]) {
			var module = (modules[id] = { exports:{}, id:id, require:require });
			if (Object.defineProperties) { Object.defineProperties(module, props); }
			if (Object.seal) { Object.seal(module); }

			stack[stack.length] = id;
			defs[id].call(global, module, module.exports);
			--stack.length;
		}
		return modules[id].exports;
	} global.require = require;

	function resolve(id) {
		if (id.slice(-ext.length) === ext) { id = id.slice(0, -ext.length); }
		var base = (this != global && this.id) || (stack.length && stack[stack.length-1]);
		if (!base) { return id; }
		if (id.charAt(0) === '.') { id = base.replace(last, id); }
		var orig = id.split('/'), terms = [], i, l = orig.length;
		for (i = 0; i < l; ++i) {
			if (orig[i] === '..') { terms.pop(); }
			else if (orig[i] !== '.') { terms[terms.length] = orig[i]; }
		}
		return terms.join('/');
	} require.resolve = resolve;

	require.define = function(id, fn) { defs[id] = fn; };
	require.cache = modules;

	if (Object.defineProperties) { Object.defineProperties(require, { define:readOnly, resolve:readOnly, cache:readOnly }); }
})();
