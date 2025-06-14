/**
 * @fileoverview Mastodon strategy for posting messages.
 * @author Nicholas C. Zakas
 */

/* global fetch, FormData, Blob */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { getImageMimeType } from "../util/images.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @typedef {import("../types.js").PostOptions} PostOptions
 */

/**
 * @typedef {Object} MastodonOptions
 * @property {string} accessToken The access token for the Mastodon account.
 * @property {string} host The host for the Mastodon instance.
 *
 * @typedef {Object} MastodonErrorResponse
 * @property {string} error The error message returned by the Mastodon API.
 *
 * @typedef {Object} MastodonMediaSize
 * @property {number} width The width of the media.
 * @property {number} height The height of the media.
 * @property {string} size The size as string (e.g. "640x480").
 * @property {number} aspect The aspect ratio.
 *
 * @typedef {Object} MastodonMediaFocus
 * @property {number} x The x coordinate of the focus point.
 * @property {number} y The y coordinate of the focus point.
 *
 * @typedef {Object} MastodonMediaResponse
 * @property {string} id The unique identifier of the uploaded media
 * @property {string} type The type of media (e.g. "image")
 * @property {string|null} url The URL of the media
 * @property {string} preview_url The URL of the preview image
 * @property {string|null} remote_url The remote URL of the media if applicable
 * @property {string} text_url The text URL of the media
 * @property {Object} meta Metadata about the media
 * @property {MastodonMediaFocus} meta.focus The focus point coordinates
 * @property {MastodonMediaSize} meta.original The original image dimensions
 * @property {MastodonMediaSize} meta.small The small preview dimensions
 * @property {string} description Alt text description of the media
 * @property {string} blurhash The blurhash string for the media
 *
 * @typedef {Object} MastodonMediaAttachment
 * @property {string} id The unique identifier of the media attachment
 * @property {string} type The type of media (e.g. "image")
 * @property {string|null} url The URL of the full-size media
 * @property {string} preview_url The URL of the preview image
 * @property {string|null} remote_url The remote URL of the media if hosted elsewhere
 * @property {string|null} text_url The text URL of the media
 * @property {Object} meta Metadata about the media attachment
 * @property {string} description Alt text description of the media
 * @property {string} blurhash The blurhash string for generating a placeholder
 *
 * @typedef {Object} MastodonPostResponse
 * @property {string} id The unique identifier of the post.
 * @property {string} uri The URI of the post.
 * @property {string} url The URL of the post.
 * @property {string} content The content of the post.
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * Uploads media to Mastodon.
 * @param {Object} options The upload options.
 * @param {string} options.accessToken The Mastodon access token.
 * @param {string} options.host The Mastodon host.
 * @param {Object} image The image to upload.
 * @param {Uint8Array} image.data The image data.
 * @param {string} [image.alt] Alt text for the image.
 * @param {AbortSignal} [signal] The abort signal.
 * @returns {Promise<string>} A promise that resolves with the media ID.
 * @throws {Error} If the upload fails.
 */
async function uploadMedia({ accessToken, host }, image, signal) {
	const url = `https://${host}/api/v1/media`;
	const type = getImageMimeType(image.data);

	if (!type) {
		throw new TypeError("Unsupported image type.");
	}

	const data = new FormData();
	data.append("file", new Blob([image.data], { type }));

	if (image.alt) {
		data.append("description", image.alt);
	}

	const response = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
		body: data,
		signal,
	});

	if (!response.ok) {
		const { error } = /**@type {MastodonErrorResponse} */ (
			await response.json()
		);
		throw new Error(
			`${response.status} ${response.statusText}: Failed to upload media: ${response.status} ${response.statusText}${error ? `: ${error}` : ""}`,
		);
	}

	const result = /** @type {MastodonMediaResponse} */ (await response.json());
	return result.id;
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A strategy for posting messages to Mastodon.
 */
export class MastodonStrategy {
	/**
	 * The ID of the strategy.
	 * @type {string}
	 * @readonly
	 */
	id = "mastodon";

	/**
	 * The display name of the strategy.
	 * @type {string}
	 * @readonly
	 */
	name = "Mastodon";

	/**
	 * Options for this instance.
	 * @type {MastodonOptions}
	 */
	#options;

	/**
	 * Maximum length of a Mastodon post in characters (default instance limit).
	 * @type {number}
	 * @const
	 */
	MAX_MESSAGE_LENGTH = 500;

	/**
	 * Creates a new instance.
	 * @param {MastodonOptions} options Options for the instance.
	 * @throws {Error} When options are missing.
	 */
	constructor(options) {
		const { accessToken, host } = options;

		if (!accessToken) {
			throw new TypeError("Missing Mastodon access token.");
		}

		if (!host) {
			throw new TypeError("Missing Mastodon host.");
		}

		this.#options = options;
	}

	/**
	 * Calculates the length of a message according to Mastodon's algorithm.
	 * All characters, including URLs, are counted as their actual length.
	 * @param {string} message The message to calculate the length of.
	 * @returns {number} The calculated length of the message.
	 */
	calculateMessageLength(message) {
		return [...message].length;
	}

	/**
	 * Posts a message to Mastodon.
	 * @param {string} message The message to post.
	 * @param {PostOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<Object>} A promise that resolves with the post data.
	 */
	async post(message, postOptions) {
		if (!message) {
			throw new Error("Missing message to toot.");
		}

		// Validate postOptions if provided
		if (postOptions) {
			if (postOptions.images && !Array.isArray(postOptions.images)) {
				throw new TypeError("images must be an array.");
			}

			if (postOptions.images) {
				for (const image of postOptions.images) {
					if (!image.data) {
						throw new TypeError("Image must have data.");
					}
					if (!(image.data instanceof Uint8Array)) {
						throw new TypeError("Image data must be a Uint8Array.");
					}
				}
			}
		}

		const { accessToken, host } = this.#options;
		const url = `https://${host}/api/v1/statuses`;
		const data = new FormData();
		data.append("status", message);

		// Upload images first if present
		if (postOptions?.images?.length) {
			const mediaIds = await Promise.all(
				postOptions.images.map(image =>
					uploadMedia(this.#options, image, postOptions?.signal),
				),
			);

			data.append("media_ids[]", mediaIds.join(","));
		}

		const response = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
			body: data,
			signal: postOptions?.signal,
		});

		if (!response.ok) {
			const { error } = /**@type {MastodonErrorResponse} */ (
				await response.json()
			);
			throw new Error(
				`Failed to post message: ${response.status} ${response.statusText}${error ? `: ${error}` : ""}`,
			);
		}

		return /**@type {Object} */ (await response.json());
	}

	/**
	 * Extracts a URL from a Mastodon API response.
	 * @param {MastodonPostResponse} response The response from the Mastodon API post request.
	 * @returns {string} The URL for the Mastodon post.
	 */
	getUrlFromResponse(response) {
		if (!response?.uri) {
			throw new Error("Post URI not found in response");
		}

		// Replace the instance domain with our known host
		// URI format: https://instance.domain/users/username/statuses/123456789
		// We want: https://our.host/@username/123456789
		const uriParts = response.uri.split("/");
		if (uriParts.length < 2) {
			throw new Error("Invalid URI format in response");
		}

		const username = uriParts[uriParts.length - 3]; // Extract username from URI
		const statusId = uriParts[uriParts.length - 1]; // Extract status ID from URI

		return `https://${this.#options.host}/@${username}/${statusId}`;
	}
}
