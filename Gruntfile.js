module.exports = function(grunt) {
    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

    grunt.initConfig({

        jshint: {
            server: {
                files: {
                    src: ['*.js', 'server/**/*.js']
                },
                options: {
                    node: true
                }
            },
            browser: {
                files: {
                    src: ['app/**/*.js']
                },
                options: {
                    browser: true,
                    devel: true,
                    globals: {
                        angular: true,
                        _: true
                    }
                }
            },
            options: {
                bitwise: true,
                eqeqeq: true,
                freeze: true,
                immed: true,
                indent: 4,
                latedef: true,
                newcap: true,
                nonew: true,
                quotmark: 'single',
                undef: true,
                unused: true,
                trailing: true,
            }
        }

    });

    grunt.registerTask('default', [
        'jshint'
    ]);
};
