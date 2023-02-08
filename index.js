#! /usr/bin/env node

const argPrefix = '-';
const defaultConfigFileName = 'embed-fonts.config.json';

const shell = require("shelljs");
const fs = require('fs');
const path = require('path');
const package = require('./package.json');
const CleanCSS  = require('clean-css');
const tools = require('./helper/tools');

const cfgFile = tools.fromCommandLineArg('config', argPrefix) || defaultConfigFileName;
const config = JSON.parse(fs.readFileSync(cfgFile));

if(config && config.skipCertificateCheck) {
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
//process.env.NODE_TLS_REJECT_UNAUTHORIZED='0'
}

console.log(config);

var fontFace = /@font-face\s*\{[^\}]*}/g,
    allUrl = /url\(['"]?([^)'"]*)['"]?\)/ig,
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
            var filewithRemovedQuery = file.split('?')[0];
            return await getDataUriForContentAsync(data, fontType.exec(filewithRemovedQuery), options);
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
            fontMimeType = fontMimeTypes[typeMatch] || (await tools.mimeTypeForContent(faceContent)) || 'application/octet-stream';
        }
    }

    return 'data:' + fontMimeType + ';base64,' + fontEncoded;
}

async function getDataUriForFile(fontFile, options) {
    return await getDataUriForContentAsync(fs.readFileSync(fontFile), fontType.exec(fontFile), options);
}

async function embedFontUrlsAsync(fileSrc, faceContent, options) {
    var isMatchingFile = (fontFile, fileNameRegExps) => fileNameRegExps.some((fileNameRegExp) => fontFile.match(fileNameRegExp)),
        urlMatch,
        mimeTypes,
        currentFontUrl = allUrl;
    if (options.applyTo) {
        mimeTypes = options.applyTo.join('|');
        currentFontUrl = new RegExp("url\\([\"']?(?!\\/\\/)([^\\?#\"'\\)]+\\.(?:" + mimeTypes + "))((?:\\?[^#\"'\\)]*)?(?:#[^\"'\\)]*))?[\"']?\\)", "ig");
    }

    while ((urlMatch = currentFontUrl.exec(faceContent))) {
        let fontFile = urlMatch[1];
        if (fontFile.indexOf(':') < 0 || fontFile.toLowerCase().startsWith('http')) {
            if (!path.isAbsolute(fontFile) && !fontFile.toLowerCase().startsWith('http')) {
                try
                {
                    fontFile = path.join(options.baseDir, fontFile);
                }
                catch (e) {
                    // Font file is maybe relative to remote stylesheet
                    fontFile = tools.combineUrl(fileSrc, fontFile);
                    console.log('Font file is maybe relative to remote stylesheet: ' + fontFile);
                }
            }
            if (!options.only || isMatchingFile(fontFile, options.only)) {
                const result = await getDataUriAsync(fontFile, options);
                faceContent = faceContent.replace(urlMatch[0], 'url(' + result + ')');
            }
        }
    }
    return faceContent;
}

async function updateFontFacesAsync(fileSrc, fileContent, options) {
    let faceMatch;
    while ((faceMatch = fontFace.exec(fileContent))) {
        const faceContent = await embedFontUrlsAsync(fileSrc, faceMatch[0], options);
        fileContent = fileContent.replace(faceMatch[0], faceContent);
    }
    return fileContent;
}

async function processStylesheet(file, options) {
    const fileSrc = file.from;
    const fileDest = file.to;
    const minify = file.minify !== undefined ? file.minify : options.minify;
    const bundle = options.bundledOutputFile ? _(options.bundledOutputFile) : null;
    console.log('Processing stylesheet from "' + fileSrc + '" to "' + fileDest + '"');

    if (!options.baseDir && !fileSrc.toLowerCase().startsWith('http')) {
        options.baseDir = path.dirname(fileSrc);
    }

    let content = fileSrc.toLowerCase().startsWith('http')
        ? await tools.readStringFromUrlAsync(fileSrc)
        : await fs.readFileSync(fileSrc, 'utf8');
    content = await updateFontFacesAsync(fileSrc, content, options);

    (Array.isArray(fileDest) ? fileDest : [fileDest]).forEach(to => {
        (_(to, true) || [null]).forEach(f => {
            if (minify) {
                content = new CleanCSS().minify(content).styles;
            }
            if (bundle) {
                fs.appendFileSync(bundle, content);
            }
            if (f) {
                const fileName = tools.ensureFile(f, tools.urlAsFileName(path.basename(fileSrc)));
                fs.writeFileSync(fileName, content);
            }
        });
    });
}

async function run(files) {
    const bundle = config.bundledOutputFile ? _(config.bundledOutputFile) : null;
    if (bundle) {
        fs.writeFileSync(tools.ensureFile(bundle), '');
    }

    for (const file of files) {
        await processStylesheet(file, config);
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

//console.log('Config: ' + JSON.stringify(config, null, 2));


var files = spread(config['embed-font-files'] || config['mappings']);
run(files).then(() => console.log(`DONE !!`) );


