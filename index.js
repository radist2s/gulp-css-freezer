var util = require('util')
var gutil = require('gulp-util')
var through2 = require('through2')
var through = require('through')
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
    var self = this

    var stream = this.createStream(this.pipeMainTransform, function () {
        this.queue(self.freezeMapFile)
        this.queue(null)
    })

    if (this.config.freeze) {
        stream.pipe(
            this.createStream(this.pipeFreezedFilesCollectorTransform, function () {
                self.freezeMapFile.contents.emit('startFlush')

                this.queue(null)
            })
        )
    }

    return stream
}

CssFreezer.prototype.config = {
    includeProtocols: [],
    urlFilter: null,
    prependUrlFilter: false,
    freeze: true,
    freezeNestingLevel: 1,
    freezeMapFileName: 'css-freeze-map.json',
    freezeMapBaseDir: null
}

CssFreezer.prototype.createStream = function (transformCallback, endCallback) {
    var _this = this

    return through(function (sourceFile, enc, cb) {
        var stream = this

        transformCallback.bind(_this, stream).apply(_this, arguments)
    }, endCallback)
}

CssFreezer.prototype.pipeMainTransform = function pipeMainTransform(stream, sourceFile) {
    if (sourceFile.isNull()) {
        return stream.emit('data', sourceFile)
    }

    if (sourceFile.isStream()) {
        return stream.emit('error', new gutil.PluginError(PLUGIN_NAME, 'Streaming not supported'))
    }

    try {
        var destFile

        if (this.config.freeze) {
            if (!this.freezeMapFile) {
                // Create Freeze Map Stream Source
                this.freezeMapFileSource = new FreezeMapFileSource()

                // Waite for gulp.dest() to get destination path
                this.freezeMapFileSource.transform.on('beforeFlush', function (freezeMap) {
                    var relativeFreezeMap = this.resolveFreezedMapLinks(freezeMap)

                    this.freezeMapFileSource.transform.emit('completeFlush', relativeFreezeMap)
                }.bind(this))

                this.freezeMapFile = new gutil.File({
                    path: this.config.freezeMapFileName,
                    base: '',
                    cwd: '',
                    contents: this.freezeMapFileSource.transform
                })
            }

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
}

CssFreezer.prototype.freezeLinks = function freezeLinks(cssFile, stream, url) {
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

    stream.push(file)

    return filePath + urlData.query
}

CssFreezer.prototype.pipeFreezedFilesCollectorTransform = function pipeFreezedFilesCollectorTransform(stream, sourceFile) {
    if (sourceFile.sourcePath) {
        this.freezeMapFileSource.push(sourceFile.sourcePath, sourceFile.path)
    }
}

CssFreezer.prototype.resolveFreezedMapLinks = function (freezeMap) {
    if (!this.config.freezeMapBaseDir) {
        return
    }

    var freezeMapFile = this.freezeMapFile

    console.log(freezeMapFile.path)

    var freezeMapBaseDir = this.config.freezeMapBaseDir,
        destinationBaseDir = path.dirname(freezeMapFile.path),
        relativeFreezeMap = Object.create(null)

    Object.keys(freezeMap).forEach(function (sourcePath) {
        var freezedPath = freezeMap[sourcePath]

        sourcePath = path.relative(freezeMapBaseDir, sourcePath)
        console.log(path.join(destinationBaseDir, freezedPath))
        freezedPath = path.relative(freezeMapBaseDir, path.join(destinationBaseDir, freezedPath))

        relativeFreezeMap[sourcePath] = freezedPath
    }.bind(this))

    return relativeFreezeMap
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

    // Flush executes gulp.dest()
    transform._flush = function (done) {
        var freezeMap = self.read(true)

        this.once('startFlush', function () {
            console.log("FLUSH START")

            this.emit('beforeFlush', freezeMap)
        })

        this.once('completeFlush', function (freezePath) {
            console.log("FLUSH COMPLETE")

            this.push(JSON.stringify(freezePath, null, 1))

            done()
        })
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

module.exports = function gulpCssFreezer(options) {
    var cssFreezer = new CssFreezer(options)

    return cssFreezer.stream()
}