module.exports = function(grunt) {
    grunt.loadNpmTasks('grunt-contrib-jshint');

    grunt.initConfig({

        jshint: {
            server: {
                files: {
                    src: ['*.js', 'lib/**/*.js']
                },
            },
            options: {
                node: true,
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
