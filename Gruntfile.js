const webpackConfig = require('./webpack.config.js');
const path = require("path");
const os = require('node:os');

module.exports = function (grunt) {
    let config = {
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
        }
    }
    if (os.type() === "Windows_NT") {
        config = Object.assign(config,
            {
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
            })
    }
    grunt.initConfig(config);

    grunt.loadNpmTasks('grunt-webpack');

    grunt.registerTask('build', ['webpack:build'])
    grunt.registerTask('install', ' Build and install the addon to the game\'s addon directory.', function () {
        grunt.loadNpmTasks('grunt-contrib-copy')
        grunt.task.run('webpack:build')
        grunt.task.run('copy:main')
    })
    grunt.registerTask('package', '', function () {
        grunt.loadNpmTasks('grunt-contrib-compress')
        grunt.task.run('webpack:build')
        grunt.task.run('compress:main')
    })
};