var increment = require('./increment').increment;
exports.incrementAll = function() {
	var v = Array.prototype.slice.call(arguments, 0), i = v.length;
	while (i--) { v[i] = increment(v[i]); }
	return v;
};