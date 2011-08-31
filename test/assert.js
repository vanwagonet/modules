var cases = [];
exports.assert = function(expr, msg) {
	cases[cases.length] = { result:expr, message:msg };
};
exports.report = function(name) {
	var div = document.createElement('div'), result,
		c, cc = cases.length, errors = 0, html = '';
	html += '<ol class="cases">';
	for (c = 0; c < cc; ++c) {
		if (!cases[c].result) { ++errors; }
		result = (cases[c].result ? 'pass' : 'fail');
		html += '<li class="' + result + '">' + result.toUpperCase() + ': ' + cases[c].message + '</li>';
	}
	html += '</ol>';
	div.innerHTML = name+': '+(cc-errors)+'/'+cc+' correct assertions' + html;
	div.className = 'report ' + (errors ? ' fail' : ' pass');
	div.tabIndex = 0; // make focusable
	document.body.appendChild(div);
	errors.length = (count = 0); // reset stats
};