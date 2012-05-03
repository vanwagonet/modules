# modules

CommonJS modules implementation for web applications written by Andy VanWagoner
([thetalecrafter](http://github.com/thetalecrafter)).

Some of the motivation for this project can be found in [this article](http://thetalecrafter.wordpress.com/2011/09/22/commonjs-in-the-browser/).

## Client-Side Features

 * Modules 1.1.1 implementation for in-browser use
 * module.require function similar to nodejs implementation

## Server-Side Features

 * Automatically put all modules into a single js file
 * Configure minification using your favorite compressor
 * Manage configurations in a json file

## Usage

PHP:

```php
<?= Modules::script() ?>
```

Client JavaScript (using modules):

```javascript
var module = require('some/module'); // returns exports of that module
```

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

