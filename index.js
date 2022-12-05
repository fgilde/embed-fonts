#! /usr/bin/env node

const argPrefix = '-';
const defaultConfigFileName = 'embed-fonts.config.json';

const shell = require("shelljs");
const fs = require('fs');
const path = require('path');
const package = require('./package.json');
var tools = require('./helper/tools');

const cfgFile = tools.fromCommandLineArg('config', argPrefix) || defaultConfigFileName;
const config = JSON.parse(fs.readFileSync(cfgFile));
console.log(config);

var fontFace = /@font-face\s*\{[^\}]*}/g,
    fontUrl = /url\(["']?(?!\/\/)([^\?#"'\)]+\.(?:eot|svg|ttf|otf|woff|woff2))((?:\?[^#"'\)]*)?(?:#[^"'\)]*))?["']?\)/ig,
    fontType = /\.((?:[a-zA-Z]+)2?)$/,
    fontMimeTypes = {
        eot: 'application/vnd.ms-fontobject',
        otf: 'application/font-sfnt',
        svg: 'image/svg+xml',
        ttf: 'application/font-sfnt',
        woff: 'application/font-woff',
        woff2: 'font/woff2'
    };

function getDataUri(fontFile, options) {
    var typeMatchResult = fontType.exec(fontFile),
        typeMatch = typeMatchResult[1].toLowerCase(),
        //faceContent = grunt.file.read(fontFile, {encoding: null}),
        faceContent = fs.readFileSync(fontFile),
        fontEncoded = faceContent.toString('base64'),
        fontMimeType = options.mimeTypeOverrides[typeMatch];
    if (!fontMimeType) {
        if (options.fontMimeType) {
            fontMimeType = 'font/' + typeMatch;
        } else if (options.xFontMimeType) {
            fontMimeType = 'application/x-font-' + typeMatch;
        } else {
            fontMimeType = fontMimeTypes[typeMatch];
        }
    }
    console.log('Embedding "' + fontFile + '" as "' + fontMimeType + '".');
    return 'data:' + fontMimeType + ';base64,' + fontEncoded;
}

function embedFontUrls(faceContent, options) {

    var isMatchingFile = function (fontFile, fileNameRegExps) {
        return fileNameRegExps.some(function (fileNameRegExp) {
            return fontFile.match(fileNameRegExp);
        });
    };

    var urlMatch;
    var mimeTypes;
    var currentFontUrl = fontUrl;
    if (options.applyTo) {
        mimeTypes = options.applyTo.join('|');
        currentFontUrl = new RegExp("url\\([\"']?(?!\\/\\/)([^\\?#\"'\\)]+\\.(?:" + mimeTypes + "))((?:\\?[^#\"'\\)]*)?(?:#[^\"'\\)]*))?[\"']?\\)", "ig");
    }
    while ((urlMatch = currentFontUrl.exec(faceContent))) {
        var fontFile = urlMatch[1];
        if (fontFile.indexOf(':') < 0) {
            if (!path.isAbsolute(fontFile)) {
                fontFile = path.join(options.baseDir, fontFile);
            }
            if (!options.only || isMatchingFile(fontFile, options.only)) {
                var fontAnchor = urlMatch[2] || '',
                    fontEmbedded = 'url("' + getDataUri(fontFile, options) + fontAnchor + '")';
                faceContent = faceContent.substr(0, urlMatch.index) + fontEmbedded +
                    faceContent.substr(urlMatch.index + urlMatch[0].length);
            }
        }
    }
    return faceContent;
}

function updateFontFaces(fileContent, options) {
    var faceMatch;
    while ((faceMatch = fontFace.exec(fileContent))) {
        var faceContent = embedFontUrls(faceMatch[0], options);
        fileContent = fileContent.substr(0, faceMatch.index) + faceContent +
            fileContent.substr(faceMatch.index + faceMatch[0].length);
    }
    return fileContent;
}

function processStylesheet(fileSrc, fileDest, options) {
    try {
        if (!options.baseDir) {
            options.baseDir = path.dirname(fileSrc);
        }
        var fileContent = fs.readFileSync(fileSrc, 'utf8');
        fileContent = updateFontFaces(fileContent, options);
        fs.writeFileSync(fileDest, fileContent);
    } catch (error) {
        console.error(error);
        console.warn('Processing stylesheet "' + fileSrc + '" failed\n');
    }
}

function _(str, asArray) { // replaces all placeholders in str
    return tools._(config, str, asArray);
}

function spread(mappings) {
    return tools.spread(config, mappings);
}


shell.exec(`echo ${package.name} v${package.version} started`);

if (!config.mimeTypeOverrides) {
    config.mimeTypeOverrides = {};
}

var files = spread(config['embed-font-files']);
files.forEach(file => {
    console.log('Processing stylesheet from "' + file.from + '" to "' + file.to + '"');
    processStylesheet(file.from, file.to, config);
});
