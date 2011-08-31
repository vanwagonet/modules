var require = (function(){
	var last = /\w+$/, ext = '.js', modules = {}, defs = {},
		readOnly = { writable:false, configurable:false, enumerable:true },
		props = { id:readOnly, require:readOnly,
			module:{ writable:false, configurable:false, enumerable:false } };

	function require(name) { // name is a "top-level" module id
		if (name.slice(-ext.length) === ext) { name = name.slice(0, -ext.length); }
		if (!defs[name]) { throw new Error('"'+name+'" could not be loaded'); }
		if (!modules[name]) {
			var module = (modules[name] = {
				exports:{}, id:name, require:function(id) {
					// resolve relative module id
					if (id.charAt(0) === '.') { id = name.replace(last, id); }
					var orig = id.split('/'), terms = [], i, l = orig.length;
					for (i = 0; i < l; ++i) {
						if (orig[i] === '..') { terms.pop(); }
						else if (orig[i] !== '.') { terms[terms.length] = orig[i]; }
					}
					return require(terms.join('/'));
				}
			});
			module.module = module;
			// read-only props, and cannot add or remove props if possible
			if (Object.defineProperties) { Object.defineProperties(module, props); }
			if (Object.seal) { Object.seal(module); }
			defs[name].call(module);
		}
		return modules[name].exports;
	}

	require.define = function(name, fn) { defs[name] = fn; };

	return require;
})();
