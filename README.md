# modules

CommonJS modules implementation for web applications written by Andy VanWagoner
([thetalecrafter](http://github.com/thetalecrafter)).

Some of the motivation for this project can be found in [this article](http://thetalecrafter.wordpress.com/2011/09/22/commonjs-in-the-browser/).

## Client-Side Features

 * Modules 1.1.1 implementation for in-browser use
 * `module.require` function similar to nodejs implementation
 * `require(id, callback)` for async
 * Map module ids to arbirary uris

## Server-Side Features

 * Concat multiple modules into a single js file
 * Configure minification using your favorite compressor
 * middleware for express
 * Easily create bundles

## Usage

Server JavaScript (Node.js + express)

Install modules from npm: `npm install modules`

```javascript
var app = express(), modules = require('modules');
app.use(modules.middleware({
	// all of the options are optional
	root: __dirname, // server side root directory for modules
	path: '/module/', // url path for modules
	maxAge: 24 * 60 * 60 * 1000, // Cache-Control max-age for modules
	compress: function(str, done) {
		// do compression using uglify, or your prefered compressor
		done(err, compressed); // when done or if there is an error
	},
	map: { jquery:'./lib/jquery-wrapped.min.js' }, // map pretty names to filenames
	translate: {
		html: function(id, filename, content) {
			// convert html templates to js functions, or do whatever
			//  you want to convert file types to commonjs modules
			return 'exports.template = ' + _.template(content).source;
		}
	},
	forbid: [ // blacklist files or folders you don't want accessible.
		'./config/',
		'../server.js',
		/bad-path/i, // you can use regex
		{ test:function(path) { return false; } } // or any object with a test function
	]
}));
```

Client JavaScript (using modules):

```javascript
var mod = require('some/module'); // returns exports of that module
exports.a = 'a'; // export stuff
modules.exports = function() {}; // this works too

Object.keys(module); // [ 'exports', 'id', 'uri', 'loaded', 'parent', 'children' ];
require('module/gamma', function() {
	// gamma and all of its deep dependencies have been loaded asynchronously
	var gamma = require('module/gamma');
});
```

## Browser Support

* IE 6+, Chrome, Firefox, Safari, Opera
* IE Mobile, Chrome Mobile, Firefox Mobile, Safari Mobile, Opera Mobile

Basically, if you find bugs in any browser I've heard of, I'll fix it.

### Caveats

IE before 8 requires you give the script tag an id of "require-script".
All newer browsers will look for `script[data-main]` to find the
`data-main`, `data-path`, and `data-uris` settings.

`data-uris` requires `JSON` parsing, which can be polyfilled in older browsers.

## License 

(The MIT License)

Copyright (c) 2012 Andy VanWagoner

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
