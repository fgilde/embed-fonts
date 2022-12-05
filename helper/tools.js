const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

module.exports = {
    _: function (config, str, asArray) { // replaces all placeholders in str
        const keys = Object.keys(config?.placeholders);
        let result = [];
        keys.filter(k => !Array.isArray(config.placeholders[k])).forEach(k => {
            let value = config.placeholders[k];
            str = str.replace(new RegExp(`{${k}}`, 'g'), value);
        });
        result.push(str);
        if (asArray) {
            keys.filter(k => Array.isArray(config.placeholders[k]) && str.includes(`{${k}}`)).forEach(k => {
                let value = config.placeholders[k];
                value.forEach(v => {
                    result.push(str.replace(new RegExp(`{${k}}`, 'g'), v));
                });
            });
            return result.filter(s => !keys.some(k => s.includes(`{${k}}`)));
        }

        return result[0];
    },

    spread: function (config, mappings) {
        const keys = Object.keys(config?.placeholders).filter(k => Array.isArray(config.placeholders[k])),
            result = mappings.filter(m => !keys.some(k => m.from.includes(`{${k}}`) || m.to.includes(`{${k}}`)));
        mappings.filter(m => keys.some(k => m.from.includes(`{${k}}`) || m.to.includes(`{${k}}`))).forEach(m => {
            this._(config, m.from, true).forEach((from, i) => {
                result.push({
                    from: from,
                    to: this._(config, m.to, true)[i] || this._(config, m.to)
                });
            });

        });
        //console.log(result); return [];
        return result;
    },

    readBufferFromUrl: function (url) {
        return new Promise((resolve, reject) => {
            let client = url.toLowerCase().startsWith('https') ? https : http;
            try {
                client.get(url, (resp) => {
                    let data = [];
                    resp.on('data', (chunk) => {
                        data.push(chunk);
                    });
                    resp.on('end', () => {
                        resolve(Buffer.concat(data));
                    });
                }).on("error", (err) => {
                    reject(err);
                });
            } catch (error) {
                reject(error);
            }
        });
    },

    readStringFromUrlAsync: async function (url) {
        const buffer = await this.readBufferFromUrl(url);
        return buffer.toString();
    },

    ensureFile: function (fileName, suggestedName) {
        //suggestedName = suggestedName || new Date().getTime() + "."
        if (!(path.extname(fileName))) {
            fileName += fileName.endsWith('/') ? suggestedName : `/${suggestedName}`;
        }

        let fullpath = path.resolve(fileName),
            dir = path.dirname(fileName);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        if (!fs.existsSync(fileName)) {
            // fs.closeSync(fs.openSync(filepath, 'w'));
            fs.writeFileSync(fileName, "", {flag: 'wx'});
        }
        return fileName;
    },

    fromCommandLineArg: function (name, argPrefix) {
        name = name.toLowerCase();
        var args = process.argv.slice(2).map(s => s.toLowerCase());
        return args.filter(a => a.split('=')[0]?.startsWith(`${argPrefix}${name}`))?.map(s => s.split('=').slice(1).join('='))[0];
    }

};
