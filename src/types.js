/**
 * @fileoverview Shared types for the project.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @typedef {Object} ImageEmbed
 * @property {string} [alt] The alt text for the image.
 * @property {Uint8Array} data The image data.
 */

/**
 * @typedef {[ImageEmbed]|[ImageEmbed, ImageEmbed]|[ImageEmbed, ImageEmbed, ImageEmbed]|[ImageEmbed, ImageEmbed, ImageEmbed,ImageEmbed]} ImageEmbedArray
 */

/**
 * @typedef {Object} PostOptions
 * @property {ImageEmbedArray} images An array of images to include.
 */

/**
 * @typedef {Object} Strategy
 * @property {string} name The name of the strategy.
 * @property {(message: string, options?: PostOptions) => Promise<any>} post A function that posts a message.
 */
