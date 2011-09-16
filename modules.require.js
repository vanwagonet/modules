var require = (function(){
	var last = /\w+$/, ext = '.js', modules = {}, defs = {}, stack = [],
		readOnly = { writable:false, configurable:false, enumerable:true },
		props = { id:readOnly, require:readOnly,
			module:{ writable:false, configurable:false, enumerable:false } };

	function resolve(base, id) {
		if (id.charAt(0) === '.') { id = base.replace(last, id); }
		var orig = id.split('/'), terms = [], i, l = orig.length;
		for (i = 0; i < l; ++i) {
			if (orig[i] === '..') { terms.pop(); }
			else if (orig[i] !== '.') { terms[terms.length] = orig[i]; }
		}
		return terms.join('/');
	}

	function require(id) {
		if (id.slice(-ext.length) === ext) { id = id.slice(0, -ext.length); }
		if (stack.length) { id = resolve(stack[stack.length-1], id); }
		if (!defs[id]) { throw new Error('Module "'+id+'" was not found.'); }
		if (!modules[id]) {
			var module = (modules[id] = { exports:{}, id:id, require:require });
			module.module = module;

			if (Object.defineProperties) { Object.defineProperties(module, props); }
			if (Object.seal) { Object.seal(module); }

			stack[stack.length] = id;
			defs[id].call(module);
			--stack.length;
		}
		return modules[id].exports;
	}

	require.define = function(id, fn) { defs[id] = fn; };

	if (Object.defineProperties) { Object.defineProperties(require, { define:readOnly }); }
	return require;
})();
