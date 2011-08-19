var require = (function(){
	var last = /\w+$/, ext = '.js', modules = {}, defs = {},
		readOnly = { writable:false, configurable:false, enumerable:true };

	function require(name) { // name is a "top-level" module id
		if (name.slice(-ext.length) === ext) { name = name.slice(0, -ext.length); }
		if (!defs[name]) { throw new Error('"'+name+'" could not be loaded'); }
		if (!modules[name]) {
			modules[name] = {
				exports:{}, module:{ id:name }, require:function(id) {
					// resolve relative module id
					if (id.charAt(0) === '.') { id = name.replace(last, id); }
					var orig = id.split('/'), terms = [], i, l = orig.length;
					for (i = 0; i < l; ++i) {
						if (orig[i] === '..') { terms.pop(); }
						else if (orig[i] !== '.') { terms[terms.length] = orig[i]; }
					}
					return require(terms.join('/'));
				}
			};
			if (Object.defineProperty) { // module.id read-only if possible
				Object.defineProperty(modules[name].module, 'id', readOnly);
			}
			defs[name](modules[name]);
		}
		return modules[name].exports;
	}

	require.define = function(name, fn) { defs[name] = fn; };

	return require;
})();
