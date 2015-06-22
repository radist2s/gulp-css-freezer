var util = require('util')
var gutil = require('gulp-util')
var through = require('through2')
var fs = require('fs')
var path = require('path')
var crypto = require('crypto')
var cssUrlReplacer = require('./lib/css-url-replace')

var streamLib = require('stream')

const PLUGIN_NAME = 'gulp-css-freezer'

function CssFreezer(options) {
    var config = this.config = Object.create(this.constructor.prototype.config)

    util._extend(this.config, options)

    if (config.urlFilter && !util.isFunction(config.urlFilter)) {
        throw new gutil.PluginError(PLUGIN_NAME, '`callback` required')
    }
}

CssFreezer.prototype.stream = function () {
    var stream = this.createStream(this.pipeMainTransform)

    if (this.config.freeze) {
        stream.pipe(
            this.createStream(this.pipeFreezedFilesCollectorTransform)
        )
    }

    return stream
}

CssFreezer.prototype.config = {
    includeProtocols: [],
    urlFilter: null,
    prependUrlFilter: false,
    freeze: true,
    freezeNestingLevel: 2,
    freezeMapFileName: 'css-freeze-map.json',
    freezeMapBaseDir: null,
    cssBasePath: '.'
}

CssFreezer.prototype.createStream = function (transformCallback) {
    var _this = this

    return through.obj(function () {
        var stream = this

        transformCallback.bind(_this, stream).apply(_this, arguments)
    })
}

CssFreezer.prototype.pipeMainTransform = function pipeMainTransform(stream, sourceFile, enc, cb) {
    if (sourceFile.isNull()) {
        return cb(null, sourceFile)
    }

    if (sourceFile.isStream()) {
        return cb(new gutil.PluginError(PLUGIN_NAME, 'Streaming not supported'));
    }

    var destFile

    try {
        if (this.config.freeze) {
            // Create Freeze Map Stream Source
            this.freezeMapFileSource = new FreezeMapFileSource()

            // Waite for gulp.dest() to get destination path
            this.freezeMapFileSource.transform.on('finish', this.resolveFreezedMapLinks.bind(this))

            stream.push(this.freezeMapFile = new gutil.File({
                path: 'freeze.json',
                base: '',
                cwd: '',
                contents: this.freezeMapFileSource.transform
            }))

            // Find and freeze resources
            var css = cssUrlReplacer.replace(sourceFile.contents, this.freezeLinks.bind(this, sourceFile, stream), ['//'])

            // Create Css freeze path
            var cssFilePath = this.createFileSubDirPath(this.createFileName(sourceFile))

            // Resolve freezed links in Css
            css = cssUrlReplacer.replace(css, this.resolveFreezedLinks.bind(this, cssFilePath))

            destFile = new gutil.File({
                path: cssFilePath,
                base: '',
                cwd: '',
                contents: new Buffer(css)
            })

            destFile.sourcePath = sourceFile.path
        }
        else {
            destFile = sourceFile
        }

        stream.push(destFile)
    }
    catch (err) {
        stream.emit('error', new gutil.PluginError(PLUGIN_NAME, err))
    }

    cb()
}

CssFreezer.prototype.freezeLinks = function freezeLinks(cssFile, pipe, url) {
    if (cssUrlReplacer.isExternalUrl(url)) {
        return url
    }

    var urlData = this.parsePath(url)

    var fileSourcePath = path.resolve(cssFile.base, urlData.path)

    var file = new gutil.File({
        base: '',
        cwd: '',
        path: fileSourcePath,
        contents: fs.readFileSync(fileSourcePath)
    })

    var fileName = this.createFileName(file)
    var filePath = this.createFileSubDirPath(fileName)

    file.path = filePath
    file.sourcePath = fileSourcePath

    pipe.push(file)

    return filePath + urlData.query
}

CssFreezer.prototype.pipeFreezedFilesCollectorTransform = function pipeFreezedFilesCollectorTransform(stream, sourceFile, enc, cb) {
    if (sourceFile.sourcePath) {
        this.freezeMapFileSource.push(sourceFile.sourcePath, sourceFile.path)
    }

    cb()
}

CssFreezer.prototype.resolveFreezedMapLinks = function () {
    if (!this.config.freezeMapBaseDir) {
        return
    }

    var freezeMapBaseDir = this.config.freezeMapBaseDir,
        destinationBaseDir = path.dirname(this.freezeMapFile.path),
        freezeMap = this.freezeMapFileSource.read(true),
        relativeFreezeMap = Object.create(null)

    Object.keys(freezeMap).forEach(function (sourcePath) {
        var freezedPath = freezeMap[sourcePath]

        sourcePath = path.relative(freezeMapBaseDir, sourcePath)
        freezedPath = path.relative(freezeMapBaseDir, path.join(destinationBaseDir, freezedPath))

        relativeFreezeMap[sourcePath] = freezedPath
    }.bind(this))

    this.freezeMapFile.contents = new Buffer(JSON.stringify(relativeFreezeMap, null, 2))
}

CssFreezer.prototype.resolveFreezedLinks = function resolveFreezedLinks(cssFilePath, url) {
    if (!this.config.freezeNestingLevel) {
        return url
    }

    var urlData = this.parsePath(url)

    var urlRelDir = path.relative(path.dirname(cssFilePath), path.dirname(urlData.path))

    return path.join(urlRelDir, path.basename(urlData.path) + urlData.query)
}

CssFreezer.prototype.parsePath = function parsePath(path) {
    var urlData = {
        path: '',
        query: ''
    }

    var urlUnparsed = path.replace(/([^#?]+)([#?]+.+)/i, function (match, path, query) {
        urlData.path = path
        urlData.query = query

        return ''
    })

    if (urlUnparsed) {
        urlData.path = path
    }

    return urlData
}

CssFreezer.prototype.createFileName = function createFileName(file) {
    var fileBaseName = crypto.createHash('sha1').update(file.contents).digest('hex')
    var fileExt = path.extname(file.path)

    return fileBaseName + fileExt
}

CssFreezer.prototype.createFileSubDirPath = function (filePath) {
    if (!this.config.freezeNestingLevel) {
        return filePath
    }

    var filename = path.basename(filePath, path.extname(filePath))

    var subDirs = []

    for (var level = 0, maxLevel = this.config.freezeNestingLevel, char; level < maxLevel; level++) {
        char = filename.substr(level, 1)

        if (char) {
            subDirs.push(char)
        }
        else {
            break
        }
    }

    return path.join(subDirs.join('/'), filePath)
}

function FreezeMapFileSource() {
    this.readable = new streamLib.Readable()
    var transform = this.transform = new streamLib.Transform

    var self = this

    this.readable._read = function () {
        // Continue to Flush
        this.push(null)
    }

    // Usually flushed data not uses, file.contents replaced by Buffer
    // in CssFreezer.prototype.resolveFreezedMapLinks on gulp.dest()
    transform._flush = function (done) {
        this.push(self.read())
        done()
    }

    this.readable.pipe(transform)

    this.freezeMap = Object.create(null)
}

FreezeMapFileSource.prototype.push = function (sourceFile, freezedFile) {
    this.freezeMap[sourceFile] = freezedFile
}

FreezeMapFileSource.prototype.read = function (returnObject) {
    return returnObject ? this.freezeMap : JSON.stringify(this.freezeMap, null, 2)
}

module.exports = function (options) {
    var cssFreezer = new CssFreezer(options)

    return cssFreezer.stream()
}