module.exports = function(grunt) {
    require('matchdep').filter('grunt-*').forEach(grunt.loadNpmTasks);

    grunt.initConfig({

        jshint: {
            all: [
                '*.js',
                'lib/**/*.js',
                'app/js/**/*.js'
            ],
            options: {

            }
        },

        // ## //

        bower: {
            install: {
                options: {
                    copy: false
                }
            }
        }

    });

    grunt.registerTask('default', [
        'jshint:all'
    ]);
};
