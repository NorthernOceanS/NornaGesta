const webpackConfig = require('./webpack.config.js');
const path = require("path");

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
                    src: ["scripts/**", "manifest.json", "pack_icon.png"]
                }]
            }
        },
        copy: {
            main: {
                files: [
                    {
                        src: ["scripts/**", "manifest.json", "pack_icon.png"],
                        dest: //From https://github.com/minecraft-addon-tools/minecraft-addon-toolchain/blob/d02f2e6e5a0bff83ec55a84205bc464d317ee6c1/packages/minecraft-addon-toolchain/v0/index.js#L12
                            path.join(
                                process.env["LOCALAPPDATA"], "Packages\\Microsoft.MinecraftUWP_8wekyb3d8bbwe\\LocalState\\games\\com.mojang\\development_behavior_packs\\norna\\"
                            )
                    }
                ]
            }
        }
    });

    grunt.loadNpmTasks('grunt-webpack');
    grunt.loadNpmTasks('grunt-contrib-compress')
    grunt.loadNpmTasks('grunt-contrib-copy')

    grunt.registerTask('build', ['webpack:build'])
    grunt.registerTask('install', ' Build and install the addon to the game\'s addon directory.', function () {
        grunt.task.run('webpack:build')
        grunt.task.run('copy:main')
    })
    grunt.registerTask('package', '', function () {
        grunt.task.run('webpack:build')
        grunt.task.run('compress:main')
    })
};