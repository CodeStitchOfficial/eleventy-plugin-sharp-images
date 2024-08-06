const eleventyPluginSharpImages = require("./lib/eleventy-plugin-sharp-images.js");

module.exports = function (eleventyConfig) {
    eleventyConfig.addPlugin(eleventyPluginSharpImages, {
        urlPath: "/assets/images",
        outputDir: "public/assets/images",
    });

    return {
        dir: {
            input: "test",
            output: "public",
            includes: "_includes",
            data: "_data",
        },
        htmlTemplateEngine: "njk",
    };
};