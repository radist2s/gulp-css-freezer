var util = require('util')
var protocolTester = require('external-protocol-tester')

var findUrlRegExp = /url\s*\(\s*(['"]?)([^"'\)]*)\1\s*\)/gi

/**
 * Filters CSS url by Callback
 * You can pass included protocols by array [http, https, data, //, file]
 *
 * @param _css {string|Buffer} CSS Code
 * @param _urlFilterCallback {Function|Array|string} Included protocols or Callback
 * @param _includeProtocols {Function|Array|string} Callback or Included protocols
 * @returns {string}
 */
function cssUrlReplace(_css, _urlFilterCallback, _includeProtocols) {
    var urlFilterCallback, css, includeProtocols

    css = _css
    css = util.isBuffer(css) ? css.toString('utf-8') : String(css)

    if (util.isFunction(_urlFilterCallback)) {
        urlFilterCallback = _urlFilterCallback
        includeProtocols = _includeProtocols
    }
    else if (arguments.length > 2) {
        urlFilterCallback = _includeProtocols
        includeProtocols = _urlFilterCallback
    }

    if (util.isString(includeProtocols) || includeProtocols instanceof String) {
        includeProtocols = [includeProtocols]
    }

    if (!util.isFunction(urlFilterCallback)) {
        throw new Error('`callback` is not a function')
    }

    if (includeProtocols && !(includeProtocols instanceof Array)) {
        throw new Error('`includeProtocols` is must be an array or string')
    }

    var excludeProtocolsRegExp = protocolTester.createProtocolFilter(includeProtocols)

    return css.replace(findUrlRegExp, function(match, location) {
        var url, urlFiltered

        match = match.replace(/\s/g, '');
        url = match.slice(4, -1).replace(/"|'/g, '').replace(/\\/g, '/')

        if (!excludeProtocolsRegExp || excludeProtocolsRegExp.test(url) === false) {
            urlFiltered = urlFilterCallback(url)
            
            if (url === urlFiltered) {
                return match
            }

            url = urlFiltered
        }
        else {
            return match
        }

        return 'url("' + url + '")'
    })
}

module.exports.replace = cssUrlReplace