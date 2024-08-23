// Required dependencies
const path = require('path');
const sharp = require('sharp'); // Image processing library
const crypto = require('crypto'); // For generating hashes
const fs = require('fs').promises; // Promisified file system operations

const allowedFormats = ["jpg", "jpeg", "png", "webp", "gif", "avif", "tiff"];

/**
 * Creates and returns the Sharp plugin for Eleventy
 * @param {Object} eleventyConfig - The Eleventy configuration object
 * @param {Object} options - Custom options for the plugin
 * @returns {Object} Plugin object with a clearOutputDir method
 */
function createSharpPlugin(eleventyConfig, options = {}) {
    // Merge default options with user-provided options
    const pluginOptions = {
        outputDir: 'public/assets/images', // Directory to store processed images
        urlPath: '/assets/images/', // URL path for accessing processed images
        ...options
    };

    // Cache to store processed image paths
    const imageCache = new Map();

    /**
     * Generates a hash for a given configuration object
     * This is used to create unique filenames for processed images
     * @param {Object} config - The configuration object to hash
     * @returns {string} The generated hash
     */
    function hashConfig(config) {
        return crypto.createHash('md5').update(JSON.stringify(config)).digest('hex');
    }

    /**
     * Ensures the input is in the correct Sharp configuration format
     * @param {string|Object} input - The input to process
     * @returns {Object} A properly formatted Sharp configuration object
     */
    function ensureSharpConfig(input) {
        return typeof input === 'string' ? { inputPath: input, operations: [] } : input;
    }

    /**
     * Resolves the input path relative to the Eleventy input directory
     * @param {string} inputPath - The input path to resolve
     * @returns {string} The resolved input path
     */
    function resolveInputPath(inputPath) {
        if (inputPath.startsWith('/')) {
            return path.join(eleventyConfig.dir.input, inputPath.slice(1));
        }
        return inputPath;
    }

    /**
     * Finds the last allowed format in an array of operations.
     * 
     * @param {Array<{method: string, args: Array}>} operations - An array of operation objects.
     * Each operation object should have a 'method' property (string) and an 'args' property (array).
     * or null if no match is found.
     */
    const findLastAllowedFormat = (operations) => {
        for (let i = operations.length - 1; i >= 0; i--) {
            const operation = operations[i];
            if (operation.method && allowedFormats.includes(operation.method)) {
                return operation.method;
            }
        }
        return null; // Return null if no allowed format is found
    };

    // Add the 'sharp' filter to initialize Sharp configuration
    eleventyConfig.addFilter('sharp', (inputPath) => ({
        inputPath,
        operations: [],
        toString() { return JSON.stringify(this); }
    }));

    // Get all Sharp prototype methods excluding private ones and constructor
    const sharpMethods = Object.getOwnPropertyNames(sharp.prototype)
        .filter(name => !name.startsWith('_') && name !== 'constructor');

    // Add each Sharp method as an Eleventy filter
    // This allows users to chain Sharp operations in their templates
    sharpMethods.forEach(method => {
        eleventyConfig.addFilter(method, (sharpConfig, ...args) => ({
            ...ensureSharpConfig(sharpConfig),
            operations: [...ensureSharpConfig(sharpConfig).operations, { method, args }],
            toString() { return JSON.stringify(this); }
        }));
    });

    /**
     * Add the 'getUrl' shortcode to generate image URLs
     * This shortcode is used in templates to get the URL of a processed image
     */
    eleventyConfig.addShortcode('getUrl', (sharpConfig) => {
        const config = ensureSharpConfig(sharpConfig);
        config.inputPath = resolveInputPath(config.inputPath);
        const configHash = hashConfig(config);
        const ext = path.extname(config.inputPath);
        const baseName = path.basename(config.inputPath, ext);
        const outputFormat = findLastAllowedFormat(config.operations);
        const outputExt = outputFormat ? `.${outputFormat}` : ext;
        const outputFileName = `${baseName}-${configHash}${outputExt}`;
        const outputPath = path.posix.join(pluginOptions.urlPath, outputFileName);

        // Return a comment with the configuration and the output path
        // This comment will be processed by the transform later
        return `<!-- SHARP_IMAGE ${JSON.stringify(config)} -->${outputPath}`;
    });

    /**
     * Processes an image based on the given configuration
     * @param {Object} config - The image processing configuration
     * @returns {Promise<string>} The output path of the processed image
     */
    async function processImage(config) {
        const configHash = hashConfig(config);
        if (imageCache.has(configHash)) return imageCache.get(configHash);

        const ext = path.extname(config.inputPath);
        const baseName = path.basename(config.inputPath, ext);
        const outputFormat = findLastAllowedFormat(config.operations);
        const outputExt = outputFormat ? `.${outputFormat}` : ext;
        const outputFileName = `${baseName}-${configHash}${outputExt}`;
        const outputFilePath = path.join(pluginOptions.outputDir, outputFileName);
        const outputPath = path.posix.join(pluginOptions.urlPath, outputFileName);

        try {
            // Check if the image already exists
            await fs.access(outputFilePath);
            // console.log(`Image already exists: ${outputFileName}`);
        } catch (error) {
            // If the image doesn't exist, process it
            // console.log(`Processing image: ${outputFileName}`);
            let pipeline = sharp(config.inputPath);
            config.operations.forEach(({ method, args }) => {
                pipeline = pipeline[method](...args);
            });

            await fs.mkdir(path.dirname(outputFilePath), { recursive: true });
            await pipeline.toFile(outputFilePath);
        }

        // Cache the output path
        imageCache.set(configHash, outputPath);
        return outputPath;
    }

    /**
     * Add a transform to replace image placeholders with actual image URLs
     * This transform processes all SHARP_IMAGE comments in the HTML output
     */
    eleventyConfig.addTransform('sharpTransform', async (content, outputPath) => {
        if (typeof outputPath !== 'string' || !outputPath.endsWith('.html')) return content;

        const regex = /<!-- SHARP_IMAGE (.*?) -->(.*?)(?=["'\s])/g;
        const promises = [];

        // First pass: collect all image processing promises
        content = content.replace(regex, (match, configString, originalPath) => {
            const config = JSON.parse(configString);
            const configHash = hashConfig(config);
            if (imageCache.has(configHash)) {
                return imageCache.get(configHash);
            }
            promises.push(processImage(config));
            return originalPath;
        });

        // Wait for all image processing to complete
        await Promise.all(promises);

        // Second pass: replace placeholders with actual image URLs
        content = content.replace(regex, (match, configString, originalPath) => {
            const config = JSON.parse(configString);
            const configHash = hashConfig(config);
            return imageCache.get(configHash) || originalPath;
        });

        return content;
    });

    // Ensure the output directory exists
    fs.mkdir(pluginOptions.outputDir, { recursive: true });

    // Return the plugin object with a method to clear the output directory
    return {
        clearOutputDir: async () => {
            imageCache.clear();
            await fs.rm(pluginOptions.outputDir, { recursive: true, force: true });
            await fs.mkdir(pluginOptions.outputDir, { recursive: true });
        }
    };
}

module.exports = createSharpPlugin;