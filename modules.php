<?php
/**
 * PHP CommonJS boilerplate for in-browser module use
 *  By default, this script assumes all js files in the same directory as it,
 *   as well as all subdirectories are 
 *  Modules::html() prints the necessary script tags to make all modules available in the web app
 *  Modules::module($name) prints the module code, including all boilerplate code necessary
 *  Modules::modules() prints all of the modules code, including boilerplate
 *
 *  When the browser directly requests this file,
 *   if a module name is in the PATH_INFO, Modules::module($name) is output
 *   otherwise Modules::modules() is output
 *
 *  When this script is called from the command line Modules::modules() is output
 *
 * Copyright 2011, Andy VanWagoner
 * Released under the MIT, BSD, and GPL Licenses.
 **/
class Modules {
	/**
	 * Gets the default options used when you don't specify an option.
	 *  Defaults are loaded from the Modules.config.json file
	 **/
	public static function & getDefaultOptions() {
		if (!isset(self::$default_opts)) {
			self::$default_opts = array(
				'mod_dir'  => str_replace('\\', '/', dirname(__FILE__)),
				'return'   => false,
				'src_url'  => str_replace('\\', '/', str_replace(realpath($_SERVER['DOCUMENT_ROOT']), '', realpath(__FILE__))),
				'separate' => false,
				'indent'   => '	',
				'headers'  => array( 'Content-Type'=>true, 'Expires'=>'+30 days', 'Last-Modified'=>true ),
				'compress' => false
			);
			self::loadDefaultOptions(dirname(__FILE__).'/modules.config.json');
		}
		return self::$default_opts;
	}

	/**
	 * Sets the default options used when you don't specify an option.
	 **/
	public static function setDefaultOptions(array $opts) {
		$default_opts =& self::getDefaultOptions();
		foreach ($opts as $key => &$value) {
			if (array_key_exists($key, $default_opts)) $default_opts[$key] = $value;
		}
	}
	
	/**
	 * Loads default options from a config file
	 **/
	public static function loadDefaultOptions($file) {
		$json = file_get_contents($file);
		$json = preg_replace('/^\/\/.*?$/m', '', $json); // strip comments
		$json = preg_replace('/,\s*}/', '}', $json); // don't let trailing commas bother
		if ($json = json_decode($json, true)) self::setDefaultOptions($json);
	}

	/**
	 * Prints the script tags required to use CommonJS modules in the browser
	 * @param array $opts options influencing how the modules are found, and how the tags are printed
	 *  indent - a whitespace string to print before each script tag
	 *  src_url - the url where browser retrieves the modules
	 *  separate - if true, each module will be in it's own script tag, defaults to false
	 *  return - if true returns the output as a string, instead of printing it
	 **/
	public static function html(array $opts=null) {
		$opts =& self::getOptions($opts);
		$ind = $opts['indent'];
		$src = $opts['src_url'];
		if ($opts['separate']) {
			$modules =& self::getModules($opts);
			foreach ($modules as $name => &$filename) {
				$out .= $ind.'<script src="'.$src.'/'.$name.'"></script>'."\n";
			}
		} else {
			$out = $ind.'<script src="'.$src.'"></script>'."\n";
		}
		if ($opts['return']) return $out;
		else echo $out;
	}

	/**
	 * Prints the code for the module, including boilerplate code necessary in the browser.
	 * @param $name name of the module - must be a Modules 1.1.1 top-level module identifier
	 * @param array $opts options influencing how the module name is resolved, and how the code is printed
	 *  mod_dir - specifies the root modules folder (no trailing slash)
	 *  compress - specifies a function to compress the javascript code, or false to not compress (default array('JSMin','minify'))
	 *   the function specified must take the uncompressed code as the first parameter, and return the compressed code
	 *  return - if true the code is returned from the funtion, not printed
	 **/
	public static function module($name, array $opts=null) {
		$opts =& self::getOptions($opts);
		if (!preg_match('/^\w+(?:\/\w+)*$/', $name)) throw new Exception('"'.$name.'" is not a valid Modules 1.1.1 top-level module identifier', 1);
		$filename = $opts['mod_dir'].'/'.$name.'.js';
		if (!is_file($filename)) $filename = $opts['mod_dir'].'/'.$name.'/'.basename($name).'.js';
		if (!is_file($filename)) throw new Exception('Module "'.$name.'" could not resolve to a file', 2);
		return self::printModule($name, $filename, $opts);
	}

	/**
	 * Prints the code for all modules
	 * @param array $opts options influencing how the module name is resolved, and how the code is printed
	 *  mod_dir - specifies the root modules folder (no trailing slash)
	 *  compress - specifies a function to compress the javascript code, or false to not compress (default array('JSMin','minify'))
	 *   the function specified must take the uncompressed code as the first parameter, and return the compressed code
	 *  return - if true the code is returned from the funtion, not printed
	 **/
	public static function modules(array $opts=null) {
		$opts =& self::getOptions($opts);
		$modules =& self::getModules($opts);
		$compress = $opts['compress'];
		$return = $opts['return'];
		$opts['compress'] = !($opts['return'] = true); // take care of printing and compressing here, not in each module

		$out = '';
		foreach ($modules as $name => &$filename) {
			$out .= self::printModule($name, $filename, $opts);
		}

		if (!empty($compress['function'])) {
			if (!empty($compress['include'])) @include_once $compress['include'];
			$compressed = call_user_func($compress['function'], $out);
			if ($compressed) $out = $compressed;
		}

		if ($return) return $out;
		else echo $out;
	}

	protected static $default_opts;
	protected static function & getOptions(array &$opts=null) {
		$default_opts =& self::getDefaultOptions();
		return array(
			'mod_dir'  => empty($opts['mod_dir'])   ? $default_opts['mod_dir']  : $opts['mod_dir'],
			'return'   => !isset($opts['return'])   ? $default_opts['return']   : $opts['return'],
			'src_url'  => empty($opts['src_url'])   ? $default_opts['src_url']  : $opts['src_url'],
			'separate' => !isset($opts['separate']) ? $default_opts['separate'] : $opts['separate'],
			'indent'   => !isset($opts['indent'])   ? $default_opts['indent']   : $opts['indent'],
			'compress' => !isset($opts['compress']) ? $default_opts['compress'] : $opts['compress']
		);
	}

	protected static function & getModules(array &$opts) {
		$modules = array( 'require'=>'::boilerplate::' ); // include boilerplate first
		$mod_dir = $opts['mod_dir'];
		$prefix = strlen($mod_dir)+1;
		$files = array( $mod_dir );
		$visited = array();
		while (!empty($files)) {
			$file = array_pop($files);

			// prevent infinite looping from circular links
			$real = realpath($file);
			if ($visited[$real]) continue;
			$visited[$real] = true;

			// depth-first traveral of directories
			if (is_dir($file)) {
				if (!($dir = opendir($file))) continue;
				while (($sub = readdir($dir)) !== false) {
					if (preg_match('/^\w+\.js$/i', $sub) || is_dir($sub)) $files[] = $file.'/'.$sub;
				}
				closedir($dir);
				continue;
			}

			// convert filename to name
			$name = substr($file, $prefix, -3); // remove mod_dir prefix and .js suffix
			if (strpos($name, '/') !== false && basename($name) === basename(dirname($name))) $name = dirname($name); // namespace/mymod/mymod -> namespace/mymod

			$modules[$name] = $file;
		}
		return $modules;
	}

	protected static function printModule($name, $filename, array &$opts) {
		$out = ($name === 'require' && $filename === '::boilerplate::') ? self::$require :
			"require.define('$name',function(){with(arguments[0]){\n".file_get_contents($filename)."\n}});";

		$compress =& $opts['compress'];
		if (!empty($compress['function'])) {
			if (!empty($compress['include'])) @include_once $compress['include'];
			$compressed = call_user_func($compress['function'], $out);
			if ($compressed) $out = $compressed;
		}

		if ($opts['return']) return $out;
		else echo $out;
	}

	/**
	 * This is the require function definition and base for the boilerplate
	 **/
	protected static $require = <<<JavaScript
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
JavaScript;
}

if (realpath(__FILE__) === realpath($_SERVER['SCRIPT_FILENAME'])) {
	$opts =& Modules::getDefaultOptions();
	$headers =& $opts['headers'];
	if ($headers['Content-Type']) header('Content-Type: '.(is_string($headers['Content-Type']) ? $headers['Content-Type'] : 'text/javascript'));
	if ($headers['Expires']) header('Expires: '.gmdate('D, d M Y H:i:s', strtotime($headers['Expires'])).' GMT');
//	header("Last-Modified: " . gmdate("D, d M Y H:i:s") . " GMT");
	$name = $_SERVER['PATH_INFO'] ? substr($_SERVER['PATH_INFO'], 1) : '';
	if ($name) Modules::module($name);
	else Modules::modules();
}