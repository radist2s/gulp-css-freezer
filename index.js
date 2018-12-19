var util = require('util')
var path = require('path')
var fs = require('fs')
var gutil = require('gulp-util')
var Vinyl = require('vinyl')
var ResourceFreezer = require('static-resources-freezer')
var cssUrlReplacer = require('./lib/css-url-replace')

const PLUGIN_NAME = 'gulp-css-freezer'

const imageFilesExtensions = ['.jpg', '.jpeg', '.gif', '.png']

function pipeMainTransform(resourceFreezer, stream, sourceFile) {
    if (sourceFile.isNull()) {
        return stream.emit('data', sourceFile)
    }

    if (sourceFile.isStream()) {
        return stream.emit('error', 'Streaming not supported')
    }

    resourceFreezer.collectedWebPImages = resourceFreezer.collectedWebPImages || []

    function webpVersionCopy(freezingSourceFile, stream, url, frozenFile) {
        var fileExtension = path.extname(frozenFile.sourcePath).toLowerCase()
        
        if (imageFilesExtensions.indexOf(fileExtension) === -1) {
            return
        }

        var potentialWebpFilePath = path.join(
            path.dirname(frozenFile.sourcePath), 
            path.basename(frozenFile.sourcePath, fileExtension) + '.webp'
        )

        if (resourceFreezer.collectedWebPImages.indexOf(potentialWebpFilePath) !== -1) {
            return
        }

        if (!fs.existsSync(potentialWebpFilePath) || !fs.lstatSync(potentialWebpFilePath).isFile()) {
            return
        }
        
        var webpFileFrozenPath = path.join(
            path.dirname(frozenFile.path),
            path.basename(frozenFile.path, path.extname(frozenFile.path)) + '.webp'
        )
        
        var webpFile = new Vinyl({
            sourcePath: potentialWebpFilePath,
            base: frozenFile.base,
            cwd: '',
            path: webpFileFrozenPath,
            contents: fs.readFileSync(potentialWebpFilePath)
        })

        stream.push(webpFile)

        resourceFreezer.collectedWebPImages.push(potentialWebpFilePath)
    }

    try {
        var destFile

        var urlFilterCallback = resourceFreezer.freezeLinks.bind(resourceFreezer, sourceFile, stream, webpVersionCopy)

        // Find and freeze resources
        var css = cssUrlReplacer.replace(sourceFile.contents, urlFilterCallback, ['//'])

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