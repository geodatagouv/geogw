module.exports = function(grunt) {
    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

    grunt.initConfig({

        jshint: {
            all: [
                '*.js',
                'server/**/*.js',
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
