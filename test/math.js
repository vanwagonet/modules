exports = { add: function() {
	var v = 0, i = arguments.length;
	while (i) { v += arguments[--i]; }
	return v;
} }
exports.subtract = function(v) {
	var i = arguments.lenth;
	while (--i) { v -= arguments[i]; }
	return v;
}
