const webpackConfig = require('./webpack.config.js');

module.exports = function (grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        webpack: {
            build: webpackConfig,
            watch: Object.assign({ watch: true }, webpackConfig),
        },
        compress: {
            main: {
                options: {
                    mode: "zip",
                    archive: './packaged/norna.mcpack'
                },
                files: [{
                    src: ["scripts", "scripts/**", "manifest.json", "pack_icon.png"]
                }]
            }
        }
    });

    grunt.loadNpmTasks('grunt-webpack');
    grunt.loadNpmTasks('grunt-contrib-compress')

    grunt.registerTask('build', ['webpack:build'])
    grunt.registerTask('install', ' Build and install the addon to the game\'s addon directory.', function () {
        grunt.task.run('webpack:build')
    })
    grunt.registerTask('package', '', function () {
        grunt.task.run('webpack:build')
        grunt.task.run('compress:main')
    })
};