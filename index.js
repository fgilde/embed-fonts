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

async function getDataUriAsync(file, options) {
    if(file.toLowerCase().startsWith('http')) {
        const data = await tools.readBufferFromUrl(file);
        if (data) {
            return await getDataUriForContentAsync(data, fontType.exec(file), options);
        } else {
            return file;
        }
    } else {
        return await getDataUriForFile(file, options);
    }
}

async function getDataUriForContentAsync(faceContent, typeMatchResult, options) {
    var typeMatch = typeMatchResult[1].toLowerCase(),
        fontEncoded,
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

    return 'data:' + fontMimeType + ';base64,' + fontEncoded;
}

async function getDataUriForFile(fontFile, options) {
    return await getDataUriForContentAsync(fs.readFileSync(fontFile), fontType.exec(fontFile), options);
}

async function embedFontUrlsAsync(faceContent, options) {
    var isMatchingFile = (fontFile, fileNameRegExps) => fileNameRegExps.some((fileNameRegExp) => fontFile.match(fileNameRegExp)),
        urlMatch,
        mimeTypes,
        currentFontUrl = fontUrl;
    if (options.applyTo) {
        mimeTypes = options.applyTo.join('|');
        currentFontUrl = new RegExp("url\\([\"']?(?!\\/\\/)([^\\?#\"'\\)]+\\.(?:" + mimeTypes + "))((?:\\?[^#\"'\\)]*)?(?:#[^\"'\\)]*))?[\"']?\\)", "ig");
    }

    while ((urlMatch = currentFontUrl.exec(faceContent))) {
        let fontFile = urlMatch[1];
        if (fontFile.indexOf(':') < 0 || fontFile.toLowerCase().startsWith('http')) {
            if (!path.isAbsolute(fontFile) && !fontFile.toLowerCase().startsWith('http')) {
                fontFile = path.join(options.baseDir, fontFile);
            }
            if (!options.only || isMatchingFile(fontFile, options.only)) {
                const result = await getDataUriAsync(fontFile, options);
                faceContent = faceContent.replace(urlMatch[0], 'url(' + result + ')');
            }
        }
    }
    return faceContent;
}

async function updateFontFacesAsync(fileContent, options) {
    let faceMatch;
    while ((faceMatch = fontFace.exec(fileContent))) {
        const faceContent = await embedFontUrlsAsync(faceMatch[0], options);
        fileContent = fileContent.replace(faceMatch[0], faceContent);
    }
    return fileContent;
}

async function processStylesheet(fileSrc, fileDest, options) {
    if (!options.baseDir && !fileSrc.toLowerCase().startsWith('http')) {
        options.baseDir = path.dirname(fileSrc);
    }

    let content = fileSrc.toLowerCase().startsWith('http')
        ? await tools.readStringFromUrlAsync(fileSrc)
        : await fs.readFileSync(fileSrc, 'utf8');
    content = await updateFontFacesAsync(content, options);
    fs.writeFileSync(fileDest, content);
}

async function run(files) {
    for (const file of files) {
        console.log('Processing stylesheet from "' + file.from + '" to "' + file.to + '"');
        await processStylesheet(file.from, file.to, config);
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
run(files).then(() => console.log(`DONE !!`) );


