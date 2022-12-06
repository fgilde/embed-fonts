# Embed-Fonts
Injects content of font files into stylesheets by replacing the relative url() paths with base64 encoded data.
With this tool you can easily embed fonts or include complete remote css with embedded fonts.
You can use it for example as small helper for embedding Google Fonts onto your page with as less effort as possible.

### Step 1 Install package

```cmd
npm install --save-dev @fgilde/embed-fonts
```

### Step 2 Create config file

Create a json config file in your structure.
The default filename is `embed-fonts.config.json` but you can name your file as you want.
If you want to use a different filename you have to specify it with the `-config` parameter.
example: `embed-fonts -config="./yourpath/yourconfigfile.json"`

#### Sample config

```json
{
  "placeholders": { // Placeholders are optional
    "files": ["material-icons.css", "font-awesome.min.css"]
  },
  "embed-font-files": [
    {
      "from": "./test-styles/external/{files}",
      "to": "./test-styles/external/out_{files}"
    }
  ]
}
```

### Step 3 Use it
The command to execute is `embed-fonts`

To run this script before run build in package.json file, you just add prebuild in script like this:

```json
 "scripts": {    
    "build": "...",
    "prebuild": "npm run build-fonts",
    "build-fonts": "embed-fonts -config=\"./yourpath/yourconfigfile.json\""
  },
```

An example from the input stylesheet:

```css
@font-face {
  font-family: 'Test';
  src: url(fonts/test.woff) format("woff");
  font-weight: 400;
  font-style: normal;
}
```

An example from the generated output stylesheet:

```css
@font-face {
  font-family: 'Test';
  src: url("data:application/font-woff;base64,ZmlsZTgK") format("woff");
  font-weight: 400;
  font-style: normal;
}
```


### Helpfull
Because this tool uses same config as [remote-dependencies](https://www.npmjs.com/package/@fgilde/remote-dependencies) you can use the same config file for both tools.
And you can use the same placeholders in both tools. 
In combination of both tools you can download remote css, and font files and inject them into your stylesheets with fully embedded style.

### Useful use case
This tool is very useful if you want to use a css with fonts from a CDN.
In this we use two local files ("material-icons.css", "font-awesome.min.css") with containing local fonts from `./test-styles/external` and the Open Sans font from fonts.googleapis.com
```json
{
  "placeholders": {
    "files": ["material-icons.css", "font-awesome.min.css"]
  },
  "embed-font-files": [
    {
      "from": "https://fonts.googleapis.com/css?family=Open+Sans:300,400,700",
      "to": "./test-styles/external/my_local_open_sans_with_embedded_fonts.css"
    },
    {
      "from": "./test-styles/external/{files}",
      "to": "./test-styles/external/out_{files}"
    }
  ]
}
```

You can also completely use remote files.
Here we create local usable styles for each of material-components-web.min.css, font-awesome.min.css, Material+Icons adn Open+Sans
This produces the 4 output files `css_family_open_sans_300_400_700.css, font_awesome_min_css.css, icon_family_material_icons.css, material_components_web_min_css.css`

```json
{
  "placeholders": {
    "localDir": "./test-styles/external",
    "files": [
      "https://unpkg.com/material-components-web@4.0.0/dist/material-components-web.min.css",
      "https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css",
      "https://fonts.googleapis.com/icon?family=Material+Icons",
      "https://fonts.googleapis.com/css?family=Open+Sans:300,400,700"
    ]
  },
  "mappings": [
    {
      "minify": true, // Set this to true to minify the output
      "from": "{files}",
      "to": "{localDir}"
    }
  ]
}
```
If you dont want to have a file foreach input, you can also bundle all mappings into one file.

```json
{
  "placeholders": {
    "localDir": "./test-styles/external",
    "files": [
      "https://unpkg.com/material-components-web@4.0.0/dist/material-components-web.min.css",
      "https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css",
      "https://fonts.googleapis.com/icon?family=Material+Icons",
      "https://fonts.googleapis.com/css?family=Open+Sans:300,400,700"
    ]
  },
  "bundledOutputFile" : "{localDir}/_all_bundle.css", // bundle all to one file
  "mappings": [
    {
      "minify": true, // Set this to true to minify the output
      "from": "{files}"
      // dont provide a to, so the output will be bundled into the bundledOutputFile only
    }
  ]
}
```


### If you like this tool, please star it on [Github](https://github.com/fgilde/embed-fonts)  and share it with your friends
If not, you can give a star anyway and let me know what I can improve to make it better for you.


## Links
[Github Repository](https://github.com/fgilde/embed-fonts) | 
[NPM Package](https://www.npmjs.com/package/@fgilde/embed-fonts)
#
