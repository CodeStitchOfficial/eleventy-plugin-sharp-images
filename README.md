# eleventy-plugin-sharp-images

An Eleventy plugin that brings the full capabilities of Sharp to your static sites, optimizing assets and improving website performance. Brought to you by [CodeStitch](https://codestitch.app)!

This plugin is a continuation of the now-abandoned [eleventy-plugin-sharp](https://github.com/luwes/eleventy-plugin-sharp) by [luwes](https://github.com/luwes/).

## Table of Contents

-   [Features](#features)
-   [Installation](#installation)
-   [Configuration](#configuration)
-   [Usage](#usage)
    -   [Examples](#examples)
-   [How It Works](#how-it-works)
-   [Special Thanks](#special-thanks)

<a href="#features"></a>

## Features

1. Full Sharp integration, allowing for cropping, resizing, compressing, manipulating, and changing file types within your Eleventy project
2. Efficient caching mechanism to prevent regeneration of identical images within and between builds, both locally and when deployed to Netlify
3. Asynchronous processing - even when using non-asynchronous features (like Nunjucks Macros)

<a href="#installation"></a>

## Installation

1. Install the plugin:

```bash
npm install @codestitchofficial/eleventy-plugin-sharp-images
```

2. Configure Eleventy:

```javascript
const eleventyPluginSharpImages = require("@codestitchofficial/eleventy-plugin-sharp-images");

module.exports = function (eleventyConfig) {
    eleventyConfig.addPlugin(eleventyPluginSharpImages, {
        urlPath: "/assets/images",
        outputDir: "public/assets/images",
    });
};
```

**Important**: This plugin relies on specific HTML comments to process images. If these comments are removed or altered by minification before this plugin runs, it will cause errors. To prevent this, make sure to add any HTML minification plugins _after_ this plugin in your Eleventy configuration file. This ensures that image processing occurs before any minification takes place.

3. For caching (Netlify use only), install Netlify's caching plugin:

```bash
npm install netlify-plugin-cache
```

4. Add caching configuration to `netlify.toml` in the root of your repository:

```toml
[[plugins]]
package = "netlify-plugin-cache"

  [plugins.inputs]
  paths = [
    "public/assets/images", # Processed images - adjust to match your outputDir
    ".cache" # Remote Assets
  ]
```

<a href="#configuration"></a>

## Configuration

Only two options are needed to configure the plugin:

-   `urlPath`: The prefix for generated image URLs in your built site
-   `outputDir`: The directory where processed images should be saved

<a href="#usage"></a>

## Usage

The plugin works by using the `{% getUrl %}` shortcode, supplying an image URL, and chaining filters that correspond to [Sharp's transformation options](https://sharp.pixelplumbing.com/api-output):

```html
<picture>
    <source srcset="{% getUrl "/assets/images/image.jpg" | resize({ height: 50, width: 50 }) | avif %}" media="(max-width: 600px)" type="image/avif"> <source srcset="{% getUrl
    "/assets/images/image.jpg" | resize({ height: 50, width: 50 }) | webp %}" media="(max-width: 600px)" type="image/webp"> <source srcset="{% getUrl "/assets/images/image.jpg" |
    resize({ height: 400, width: 400 }) | jpeg %}" media="(min-width: 601px)" type="image/jpeg"> <img src="{% getUrl "/assets/images/image.jpg" | resize({ height: 400, width: 400
    }) | jpeg %}" alt="Description of the image">
</picture>
```

In this example, we set up responsive image HTML with three `<source>` elements. Each source generates an image from `/assets/images/image.jpg`, using the `resize` filter to crop the image to specific dimensions, before outputting the image in AVIF, WebP, or JPEG format.

The processed image is then cached to prevent unnecessary regeneration.

Each Sharp transformation can be used as a filter, with options passed as an object. For example, to adjust the image position during resizing:

```nunjucks
{% getUrl "/assets/images/image.jpg" | resize({ height: 50, width: 50, position: "top" }) | avif %}
```

<a href="#examples"></a>

### Examples

1. Resize image to set dimensions:

```nunjucks
{% getUrl "/assets/images/image.jpg" | resize({ height: 50, width: 50 }) %}
```

2. Resize image to set dimensions and convert to AVIF, with a quality value of 75:

```nunjucks
{% getUrl "/assets/images/image.jpg" | resize({ height: 50, width: 50 }) | avif({ quality: 75 }) %}
```

3. Resize image to set dimensions, cropped to the area of interest, and convert to AVIF:

```nunjucks
{% getUrl "/assets/images/image.jpg" | resize({ height: 50, width: 50, position: "attention" }) | avif %}
```

4. Rotate an image 90 degrees and convert it to grayscale:

```nunjucks
{% getUrl "/assets/images/image.jpg" | rotate(90) | grayscale %}
```

<a href="#how-it-works"></a>

## How It Works

To support environments where async features aren't allowed (like processing an image in a Nunjucks Macro), the shortcode doesn't directly generate the image. Instead, it creates a comment with a JSON configuration object. At the end of an Eleventy build, a Transform uses a regex to find all instances of these comments and process the images.

The configuration is hashed, and the file is renamed to include this hash. If an image path or its transformations change, the hash/filename will change, invalidating the cache. This works with netlify-plugin-cache to prevent reprocessing between builds in a live environment.

<a href="#special-thanks"></a>

## Special Thanks

-   [luwes](https://github.com/luwes/) for building the original [eleventy-plugin-sharp](https://github.com/luwes/eleventy-plugin-sharp)
-   [Multiline Comment](https://multiline.co/) for their article on [using Eleventy transforms to render asynchronous content inside Nunjucks macros](https://multiline.co/mment/2022/08/eleventy-transforms-nunjucks-macros/)
-   [Raymond Camden](https://www.raymondcamden.com/) for his guide on [using the Netlify Cache Plugin with Eleventy](https://www.raymondcamden.com/2022/06/26/testing-the-netlify-cache-plugin-with-eleventy)
