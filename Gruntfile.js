/**
 * Run automated tasks
 **/
'use strict';

module.exports = function(grunt) {

	// Project configuration.
	grunt.initConfig({
		jshint: {
			all: [
				'Gruntfile.js',
				'lib/*.js',
				'!lib/*.shim.js',
				'!lib/*.min.js'
			],
			options: {
				jshintrc: '.jshintrc'
			}
		},

		// Unit tests.
		nodeunit: {
			tests: [ 'nodeunit/**/*.test.js' ]
		}
	});

	// These plugins provide necessary tasks.
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-nodeunit');

	// Whenever the "test" task is run, run some basic tests.
	grunt.registerTask('test', [ 'nodeunit' ]);

	// By default, lint and run all tests.
	grunt.registerTask('default', [ 'jshint', 'nodeunit' ]);

};

