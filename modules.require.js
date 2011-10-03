var require = (function(){
	var last = /\w+$/, ext = '.js', modules = {}, defs = {}, stack = [],
		global = (window.global = window),
		readOnly = { writable:false, configurable:false, enumerable:true },
		props = { id:readOnly/*, require:readOnly*/ };

	function resolve(id) {
		if (!stack.length) { return id; }
		if (id.charAt(0) === '.') { id = stack[stack.length-1].replace(last, id); }
		var orig = id.split('/'), terms = [], i, l = orig.length;
		for (i = 0; i < l; ++i) {
			if (orig[i] === '..') { terms.pop(); }
			else if (orig[i] !== '.') { terms[terms.length] = orig[i]; }
		}
		return terms.join('/');
	}

	function require(oid) {
		id = resolve(oid);
		if (id.slice(-ext.length) === ext) { id = id.slice(0, -ext.length); }
		if (!defs[id]) { throw new Error('Module "'+oid+'" was not found.'); }
		if (!modules[id]) {
			var module = (modules[id] = { exports:{}, id:id/*, require:require*/ });
			if (Object.defineProperties) { Object.defineProperties(module, props); }
			if (Object.seal) { Object.seal(module); }

			stack[stack.length] = id;
			defs[id].call(global, module, module.exports);
			--stack.length;
		}
		return modules[id].exports;
	}

	require.define = function(id, fn) { defs[id] = fn; };
	require.resolve = resolve;
	require.cache = modules;

	if (Object.defineProperties) { Object.defineProperties(require, { define:readOnly }); }
	return require;
})();
