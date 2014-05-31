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
        }

    });

    grunt.registerTask('default', [
        'jshint:all'
    ]);
};
