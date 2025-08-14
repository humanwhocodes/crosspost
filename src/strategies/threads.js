/**
 * @fileoverview Threads strategy for posting messages.
 * @author Nicholas C. Zakas
 */

/* global fetch, FormData, Blob, URLSearchParams */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { validatePostOptions } from "../util/options.js";
import { getImageMimeType } from "../util/images.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/** @typedef {import("../types.js").PostOptions} PostOptions */

/**
 * @typedef {Object} ThreadsOptions
 * @property {string} accessToken The access token for the Threads API.
 * @property {string} userId The user ID for the Threads account.
 */

/**
 * @typedef {Object} ThreadsMediaUploadResponse
 * @property {string} id The ID of the uploaded media.
 */

/**
 * @typedef {Object} ThreadsPostResponse
 * @property {string} id The ID of the created post.
 */

/**
 * @typedef {Object} ThreadsErrorResponse
 * @property {Object} error The error details.
 * @property {string} error.message The error message.
 * @property {string} error.type The error type.
 * @property {number} error.code The error code.
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * Gets the URL for uploading media to Threads.
 * @param {string} userId The user ID.
 * @returns {string} The URL for uploading media.
 */
function getMediaUploadUrl(userId) {
	return `https://graph.threads.net/v1.0/${userId}/threads`;
}

/**
 * Gets the URL for creating a post on Threads.
 * @param {string} userId The user ID.
 * @returns {string} The URL for creating a post.
 */
function getCreatePostUrl(userId) {
	return `https://graph.threads.net/v1.0/${userId}/threads_publish`;
}

/**
 * Uploads an image to Threads.
 * @param {ThreadsOptions} options The options for the strategy.
 * @param {Uint8Array} imageData The image data to upload.
 * @param {string} [altText] The alt text for the image.
 * @param {AbortSignal} [signal] The abort signal for the request.
 * @returns {Promise<string>} A promise that resolves with the media ID.
 */
async function uploadImage(options, imageData, altText, signal) {
	const url = getMediaUploadUrl(options.userId);
	
	const formData = new FormData();
	const mimeType = getImageMimeType(imageData);
	const blob = new Blob([imageData], { type: mimeType });
	
	formData.append("image", blob);
	formData.append("media_type", "IMAGE");
	formData.append("access_token", options.accessToken);
	
	if (altText) {
		formData.append("alt_text", altText);
	}

	const response = await fetch(url, {
		method: "POST",
		body: formData,
		signal,
	});

	if (response.ok) {
		const result = /** @type {ThreadsMediaUploadResponse} */ (
			await response.json()
		);
		return result.id;
	}

	const errorBody = /** @type {ThreadsErrorResponse} */ (
		await response.json()
	);

	throw new Error(
		`${response.status} ${response.statusText}: Failed to upload image:\n${errorBody.error.message}`,
	);
}

/**
 * Creates a post on Threads.
 * @param {ThreadsOptions} options The options for the strategy.
 * @param {string} message The message to post.
 * @param {Array<string>} [mediaIds] The IDs of uploaded media.
 * @param {AbortSignal} [signal] The abort signal for the request.
 * @returns {Promise<ThreadsPostResponse>} A promise that resolves with the post data.
 */
async function createPost(options, message, mediaIds, signal) {
	// First create the container
	const containerUrl = getMediaUploadUrl(options.userId);
	const containerData = new URLSearchParams({
		media_type: "TEXT",
		text: message,
		access_token: options.accessToken,
	});

	if (mediaIds && mediaIds.length > 0) {
		containerData.append("children", mediaIds.join(","));
	}

	const containerResponse = await fetch(containerUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: containerData,
		signal,
	});

	if (!containerResponse.ok) {
		const errorBody = /** @type {ThreadsErrorResponse} */ (
			await containerResponse.json()
		);
		throw new Error(
			`${containerResponse.status} ${containerResponse.statusText}: Failed to create container:\n${errorBody.error.message}`,
		);
	}

	const containerResult = /** @type {ThreadsMediaUploadResponse} */ (
		await containerResponse.json()
	);

	// Then publish the container
	const publishUrl = getCreatePostUrl(options.userId);
	const publishData = new URLSearchParams({
		creation_id: containerResult.id,
		access_token: options.accessToken,
	});

	const publishResponse = await fetch(publishUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: publishData,
		signal,
	});

	if (publishResponse.ok) {
		return /** @type {Promise<ThreadsPostResponse>} */ (
			publishResponse.json()
		);
	}

	const errorBody = /** @type {ThreadsErrorResponse} */ (
		await publishResponse.json()
	);

	throw new Error(
		`${publishResponse.status} ${publishResponse.statusText}: Failed to publish post:\n${errorBody.error.message}`,
	);
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A strategy for posting messages to Threads.
 */
export class ThreadsStrategy {
	/**
	 * The ID of the strategy.
	 * @type {string}
	 * @readonly
	 */
	id = "threads";

	/**
	 * The display name of the strategy.
	 * @type {string}
	 * @readonly
	 */
	name = "Threads";

	/**
	 * Options for this instance.
	 * @type {ThreadsOptions}
	 */
	#options;

	/**
	 * Creates a new instance.
	 * @param {ThreadsOptions} options Options for the instance.
	 * @throws {TypeError} When options are missing.
	 */
	constructor(options) {
		const { accessToken, userId } = options;

		if (!accessToken) {
			throw new TypeError("Missing access token.");
		}

		if (!userId) {
			throw new TypeError("Missing user ID.");
		}

		this.#options = options;
	}

	/**
	 * Posts a message to Threads.
	 * @param {string} message The message to post.
	 * @param {PostOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<ThreadsPostResponse>} A promise that resolves with the post data.
	 */
	async post(message, postOptions) {
		if (!message) {
			throw new TypeError("Missing message to post.");
		}

		validatePostOptions(postOptions);

		postOptions?.signal?.throwIfAborted();

		let mediaIds;

		// Upload images if present
		if (postOptions?.images?.length) {
			mediaIds = await Promise.all(
				postOptions.images.map(image =>
					uploadImage(
						this.#options,
						image.data,
						image.alt,
						postOptions.signal,
					),
				),
			);

			postOptions?.signal?.throwIfAborted();
		}

		return createPost(this.#options, message, mediaIds, postOptions?.signal);
	}

	/**
	 * Extracts a URL from a Threads API response.
	 * @param {ThreadsPostResponse} response The response from the Threads post request.
	 * @returns {string} The URL for the Threads post.
	 */
	getUrlFromResponse(response) {
		if (!response?.id) {
			throw new Error("Post ID not found in response");
		}

		// Threads URLs follow the pattern: https://www.threads.net/@username/post/{post_id}
		// Since we don't have the username in the response, we'll use a generic format
		// that should redirect properly
		return `https://www.threads.net/t/${response.id}`;
	}

	/**
	 * Maximum length of a Threads post in characters.
	 * @type {number}
	 * @const
	 */
	MAX_MESSAGE_LENGTH = 500;

	/**
	 * Calculates the length of a message according to Threads' algorithm.
	 * Currently treating all characters equally, similar to Instagram.
	 * @param {string} message The message to calculate the length of.
	 * @returns {number} The calculated length of the message.
	 */
	calculateMessageLength(message) {
		return [...message].length;
	}
}