"use strict";
/*jslint node: true */
module.exports = function (grunt) {

  var files = [
    'lib/**/*.js',
    'test/*.js'
  ];

  grunt.initConfig({

    pkg: grunt.file.readJSON('package.json'),

    env: {
      coverage: {
        APP_DIR_FOR_CODE_COVERAGE: '../test/coverage/instrument/lib/'
      }
    },

    clean: {
      coverage: {
        src: ['test/coverage/']
      }
    },

    instrument: {
      files: [ 'lib/**/*.js' ],
      options: {
        lazy: true,
        basePath: 'test/coverage/instrument/'
      }
    },

    mochaTest: {
      test: {
        options: {
          reporter: 'spec',
          require: ['should']
        },
        src: ['test/**/*.js']
      }
    },

    storeCoverage: {
      options: {
        dir: 'test/coverage/reports'
      }
    },

    makeReport: {
      src: 'test/coverage/reports/**/*.json',
      options: {
        type: 'html',
        dir: 'test/coverage/reports',
        print: 'detail'
      }
    },

    watch: {
      files: files,
      tasks: ['default']
    },

    bump: {
      options: {
        files: ['package.json'],
        commit: true,
        commitMessage: 'rel v%VERSION%',
        commitFiles: ['package.json'],
        createTag: true,
        tagName: 'v%VERSION%',
        tagMessage: 'tagging new ver %VERSION%',
        push: false
      }
    }  
  });

  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-env');
  grunt.loadNpmTasks('grunt-istanbul');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-bump');

  grunt.registerTask('unit+cov',
    [
      'clean',
      'env:coverage',
      'instrument',
      'mochaTest',
      'storeCoverage',
      'makeReport'
    ]
  );

  grunt.registerTask('default', [ 'unit+cov' ]);

};
