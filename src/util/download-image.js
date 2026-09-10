/**
 * @fileoverview Utility for downloading images from URLs.
 * @author Nicholas C. Zakas
 */

/* global fetch, AbortSignal */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { getImageMimeType } from "./images.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @typedef {Object} DownloadImageOptions
 * @property {number} [maxBytes] The maximum size of the image in bytes.
 * @property {number} [timeout] The maximum time to wait for the download in milliseconds.
 *
 * @typedef {Object} DownloadedImage
 * @property {Uint8Array} data The image data.
 * @property {string} url The normalized URL the image was downloaded from.
 * @property {string} filename The filename from the URL path, or the URL if there is none.
 */

//-----------------------------------------------------------------------------
// Constants
//-----------------------------------------------------------------------------

export const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;
export const DEFAULT_TIMEOUT = 30_000;

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * Extracts a human-readable filename from a URL.
 * @param {URL} url The URL to extract the filename from.
 * @returns {string} The decoded last path segment, or the URL if there is none.
 */
function getFilename(url) {
	const segment = url.pathname.split("/").pop();

	if (!segment) {
		return url.href;
	}

	try {
		return decodeURIComponent(segment);
	} catch {
		// malformed escape sequence
		return segment;
	}
}

/**
 * Reads a response body, failing as soon as it grows larger than the limit.
 * The Content-Length header may be missing or wrong, so it can't be trusted.
 * @param {Response} response The response to read.
 * @param {number} maxBytes The maximum number of bytes to read.
 * @returns {Promise<Uint8Array>} The body data.
 * @throws {Error} If the body is larger than `maxBytes`.
 */
async function readBody(response, maxBytes) {
	if (!response.body) {
		return new Uint8Array(0);
	}

	const reader = response.body.getReader();
	/** @type {Array<Uint8Array>} */
	const chunks = [];
	let size = 0;

	while (true) {
		const { done, value } = await reader.read();

		if (done) {
			break;
		}

		size += value.length;

		if (size > maxBytes) {
			await reader.cancel();
			throw new Error(
				`The image is larger than the maximum of ${maxBytes} bytes.`,
			);
		}

		chunks.push(value);
	}

	const data = new Uint8Array(size);
	let offset = 0;

	for (const chunk of chunks) {
		data.set(chunk, offset);
		offset += chunk.length;
	}

	return data;
}

/**
 * Fetches an image and validates the response.
 * @param {URL} url The URL to fetch.
 * @param {number} maxBytes The maximum size of the image in bytes.
 * @param {AbortSignal} signal The signal to abort the request.
 * @returns {Promise<Uint8Array>} The image data.
 * @throws {Error} If the response isn't a supported image.
 */
async function fetchImage(url, maxBytes, signal) {
	const response = await fetch(url, { signal });

	if (!response.ok) {
		throw new Error(
			`The server responded with ${response.status} ${response.statusText}.`,
		);
	}

	// the image bytes are checked below, so only reject an explicit non-image
	const contentType = response.headers.get("content-type");
	if (contentType && !contentType.startsWith("image/")) {
		throw new Error(
			`The URL did not return an image (content-type: ${contentType}).`,
		);
	}

	const contentLength = Number(response.headers.get("content-length"));
	if (contentLength > maxBytes) {
		throw new Error(
			`The image is larger than the maximum of ${maxBytes} bytes.`,
		);
	}

	const data = await readBody(response, maxBytes);

	if (data.length === 0) {
		throw new Error("The server returned an empty response.");
	}

	try {
		getImageMimeType(data);
	} catch {
		throw new Error(
			`Unsupported image format${contentType ? ` (content-type: ${contentType})` : ""}. Only PNG, JPEG, and GIF are supported.`,
		);
	}

	return data;
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * Downloads an image from an HTTP or HTTPS URL.
 * @param {string} imageUrl The URL of the image.
 * @param {DownloadImageOptions} [options] Options for the download.
 * @returns {Promise<DownloadedImage>} The downloaded image.
 * @throws {TypeError} If the URL is invalid or not HTTP/HTTPS.
 * @throws {Error} If the download fails or isn't a supported image.
 */
export async function downloadImage(
	imageUrl,
	{ maxBytes = DEFAULT_MAX_BYTES, timeout = DEFAULT_TIMEOUT } = {},
) {
	/** @type {URL} */
	let url;

	try {
		url = new URL(imageUrl);
	} catch {
		throw new TypeError(`Invalid URL: ${imageUrl}`);
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new TypeError(
			`Unsupported URL protocol: ${url.protocol} (only http: and https: are supported).`,
		);
	}

	try {
		const data = await fetchImage(
			url,
			maxBytes,
			AbortSignal.timeout(timeout),
		);

		return { data, url: url.href, filename: getFilename(url) };
	} catch (error) {
		if (/** @type {Error} */ (error).name === "TimeoutError") {
			throw new Error(`The download timed out after ${timeout}ms.`);
		}

		throw error;
	}
}
