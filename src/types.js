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
 * @property {ImageEmbedArray} [images] An array of images to include.
 * @property {AbortSignal} [signal] Signal for aborting operations.
 */

/**
 * @typedef {Object} PostToOptions
 * @property {AbortSignal} [signal] Signal for aborting operations.
 */

/**
 * @typedef {Object} PostToEntry
 * @property {string} message The message to post.
 * @property {string} strategyId The ID of the strategy to use for posting.
 * @property {ImageEmbedArray} [images] An array of images to include.
 */

/**
 * @typedef {Object} Strategy
 * @property {string} name The display name of the strategy.
 * @property {string} id A unique ID for the strategy.
 * @property {(message: string, options?: PostOptions) => Promise<any>} post A function that posts a message.
 * @property {(response: any) => string} [getUrlFromResponse] A function that extracts or calculates a URL from the response.
 * @property {number} MAX_MESSAGE_LENGTH The maximum message length for the strategy.
 * @property {(message: string) => number} calculateMessageLength Calculates the message length according to the strategy's algorithm.
 */
