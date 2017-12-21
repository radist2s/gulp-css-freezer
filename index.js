var util = require('util')
var gutil = require('gulp-util')
var Vinyl = require('vinyl')
var ResourceFreezer = require('static-resources-freezer')
var cssUrlReplacer = require('./lib/css-url-replace')

const PLUGIN_NAME = 'gulp-css-freezer'

function pipeMainTransform(resourceFreezer, stream, sourceFile) {
    if (sourceFile.isNull()) {
        return stream.emit('data', sourceFile)
    }

    if (sourceFile.isStream()) {
        return stream.emit('error', 'Streaming not supported')
    }

    try {
        var destFile

        // Find and freeze resources
        var css = cssUrlReplacer.replace(sourceFile.contents, resourceFreezer.freezeLinks.bind(resourceFreezer, sourceFile, stream), ['//'])

        // Create dest file with temp content
        destFile = new Vinyl({
            path: sourceFile.path,
            base: '.',
            cwd: '',
            contents: new Buffer(css)
        })
        
        // Create CSS frozen path based on previously frozen content
        var cssFileFrozenPath = resourceFreezer.createFileSubDirPath(resourceFreezer.createFileName(destFile))

        // Resolve frozen links in Css
        css = cssUrlReplacer.replace(css, resourceFreezer.resolveFrozenLinks.bind(resourceFreezer, cssFileFrozenPath))
        
        destFile.path = cssFileFrozenPath
        destFile.contents = new Buffer(css)

        destFile.sourcePath = sourceFile.path

        stream.push(destFile)
    }
    catch (err) {
        stream.emit('error', new gutil.PluginError(PLUGIN_NAME, err))
    }
}

function gulpCssFreezer(options) {
    var config = {freezeMapFileName: 'css-freeze-map.json'}

    var resourceFreezer = new ResourceFreezer(util._extend(config, options))

    return resourceFreezer.stream(pipeMainTransform.bind(undefined, resourceFreezer))
}

gulpCssFreezer.freezeMapResolve = ResourceFreezer.freezeMapResolve

module.exports = gulpCssFreezer