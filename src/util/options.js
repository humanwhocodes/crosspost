/**
 * @fileoverview Utilities for working with options objects.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/** @typedef {import("../types.js").PostOptions} PostOptions */

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * Validates post options to ensure they meet requirements
 * @param {PostOptions} [options] The options to validate
 * @throws {TypeError} If the options are invalid
 * @returns {void}
 */
export function validatePostOptions(options) {
	if (!options) {
		return;
	}

	if (options.images && !Array.isArray(options.images)) {
		throw new TypeError("images must be an array.");
	}

	if (options.images) {
		for (const image of options.images) {
			if (!image.data) {
				throw new TypeError("Image must have data.");
			}
			if (!(image.data instanceof Uint8Array)) {
				throw new TypeError("Image data must be a Uint8Array.");
			}
		}
	}
}
