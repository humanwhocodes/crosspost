/**
 * @fileoverview Utility functions for working with images.
 * @author Nicholas C. Zakas
 */

/**
 * Determines the MIME type of an image from its binary data.
 * @param {Uint8Array} bytes The image data to examine.
 * @returns {"image/png"|"image/jpeg"|"image/gif"} The MIME type of the image.
 * @throws {TypeError} If the image type cannot be determined.
 */
export function getImageMimeType(bytes) {
	if (bytes.length < 4) {
		throw new TypeError("Unable to determine image type.");
	}

	// Check magic numbers at the start of the buffer
	if (
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47
	) {
		return "image/png";
	}

	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return "image/jpeg";
	}

	if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
		return "image/gif";
	}

	throw new TypeError("Unable to determine image type.");
}
