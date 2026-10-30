/**
 * @fileoverview Instagram strategy for posting messages.
 * @author Nicholas C. Zakas
 */

/* global fetch, FormData, Blob */

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
 * @typedef {Object} InstagramOptions
 * @property {string} accessToken The access token for the Instagram Graph API.
 * @property {string} accountId The ID of the Instagram professional account to post to.
 */

/**
 * @typedef {Object} InstagramContainerResponse
 * @property {string} id The ID of the created media container.
 */

/**
 * @typedef {Object} InstagramPublishResponse
 * @property {string} id The ID of the published media.
 */

/**
 * @typedef {Object} InstagramMediaResponse
 * @property {string} id The ID of the published media.
 * @property {string} [permalink] The permanent URL of the published media.
 */

/**
 * @typedef {Object} InstagramErrorResponse
 * @property {Object} error The error returned by the Instagram Graph API.
 * @property {string} error.message The error message.
 * @property {string} error.type The type of error.
 * @property {number} error.code The error code.
 */

//-----------------------------------------------------------------------------
// Constants
//-----------------------------------------------------------------------------

const API_BASE = "https://graph.facebook.com/v21.0";

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * Reads an error message from an Instagram Graph API response.
 * @param {Response} response The response to read the error from.
 * @returns {Promise<string>} A promise that resolves with the error message.
 */
async function readErrorMessage(response) {
	const errorResponse = /** @type {InstagramErrorResponse} */ (
		await response.json()
	);

	return errorResponse?.error?.message ?? response.statusText;
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A strategy for posting messages to Instagram.
 */
export class InstagramStrategy {
	/**
	 * The ID of the strategy.
	 * @type {string}
	 * @readonly
	 */
	id = "instagram";

	/**
	 * The display name of the strategy.
	 * @type {string}
	 * @readonly
	 */
	name = "Instagram";

	/**
	 * Maximum length of an Instagram caption in characters.
	 * @type {number}
	 * @const
	 */
	MAX_MESSAGE_LENGTH = 2200;

	/**
	 * Options for this instance.
	 * @type {InstagramOptions}
	 */
	#options;

	/**
	 * Creates a new instance.
	 * @param {InstagramOptions} options Options for the instance.
	 * @throws {TypeError} When required options are missing.
	 */
	constructor(options) {
		const { accessToken, accountId } = options;

		if (!accessToken) {
			throw new TypeError("Missing Instagram access token.");
		}

		if (!accountId) {
			throw new TypeError("Missing Instagram account ID.");
		}

		this.#options = options;
	}

	/**
	 * Creates a media container for an image.
	 * @param {import("../types.js").ImageEmbed} image The image to upload.
	 * @param {string} message The caption for the image.
	 * @param {AbortSignal} [signal] The abort signal for the request.
	 * @returns {Promise<string>} A promise that resolves with the container ID.
	 * @throws {Error} When the request fails.
	 */
	async #createContainer(image, message, signal) {
		const { accessToken, accountId } = this.#options;
		const type = getImageMimeType(image.data);
		const formData = new FormData();

		formData.append("access_token", accessToken);
		formData.append("caption", message);
		formData.append(
			"image",
			new Blob([image.data], { type }),
			`image.${type.split("/")[1]}`,
		);

		const response = await fetch(`${API_BASE}/${accountId}/media`, {
			method: "POST",
			body: formData,
			signal,
		});

		if (!response.ok) {
			throw new Error(
				`${response.status} Failed to create media container: ${await readErrorMessage(response)}`,
			);
		}

		const { id } = /** @type {InstagramContainerResponse} */ (
			await response.json()
		);

		return id;
	}

	/**
	 * Publishes a previously created media container.
	 * @param {string} creationId The ID of the media container to publish.
	 * @param {AbortSignal} [signal] The abort signal for the request.
	 * @returns {Promise<string>} A promise that resolves with the published media ID.
	 * @throws {Error} When the request fails.
	 */
	async #publishContainer(creationId, signal) {
		const { accessToken, accountId } = this.#options;
		const formData = new FormData();

		formData.append("access_token", accessToken);
		formData.append("creation_id", creationId);

		const response = await fetch(`${API_BASE}/${accountId}/media_publish`, {
			method: "POST",
			body: formData,
			signal,
		});

		if (!response.ok) {
			throw new Error(
				`${response.status} Failed to publish media: ${await readErrorMessage(response)}`,
			);
		}

		const { id } = /** @type {InstagramPublishResponse} */ (
			await response.json()
		);

		return id;
	}

	/**
	 * Fetches the permalink for a published media.
	 * @param {string} mediaId The ID of the published media.
	 * @param {AbortSignal} [signal] The abort signal for the request.
	 * @returns {Promise<string|undefined>} A promise that resolves with the permalink.
	 * @throws {Error} When the request fails.
	 */
	async #fetchPermalink(mediaId, signal) {
		const { accessToken } = this.#options;
		const url = `${API_BASE}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`;

		const response = await fetch(url, {
			method: "GET",
			signal,
		});

		if (!response.ok) {
			throw new Error(
				`${response.status} Failed to fetch media permalink: ${await readErrorMessage(response)}`,
			);
		}

		const { permalink } = /** @type {InstagramMediaResponse} */ (
			await response.json()
		);

		return permalink;
	}

	/**
	 * Posts a message to Instagram.
	 * @param {string} message The message to post.
	 * @param {PostOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<InstagramMediaResponse>} A promise that resolves with the post data.
	 * @throws {TypeError} When the message is missing.
	 * @throws {TypeError} When no image is provided.
	 */
	async post(message, postOptions) {
		if (!message) {
			throw new TypeError("Missing message to post.");
		}

		validatePostOptions(postOptions);

		if (!postOptions?.images?.length) {
			throw new TypeError("Instagram requires an image to post.");
		}

		const signal = postOptions.signal;
		const [image] = postOptions.images;

		signal?.throwIfAborted();

		const creationId = await this.#createContainer(image, message, signal);

		signal?.throwIfAborted();

		const mediaId = await this.#publishContainer(creationId, signal);

		signal?.throwIfAborted();

		const permalink = await this.#fetchPermalink(mediaId, signal);

		return { id: mediaId, permalink };
	}

	/**
	 * Extracts a URL from an Instagram API response.
	 * @param {InstagramMediaResponse} response The response from the Instagram API post request.
	 * @returns {string} The URL for the Instagram post.
	 * @throws {Error} When the permalink is missing.
	 */
	getUrlFromResponse(response) {
		if (!response?.permalink) {
			throw new Error("Permalink not found in response");
		}

		return response.permalink;
	}

	/**
	 * Calculates the length of a message according to Instagram's algorithm.
	 * All Unicode characters are counted as is.
	 * @param {string} message The message to calculate the length of.
	 * @returns {number} The calculated length of the message.
	 */
	calculateMessageLength(message) {
		return [...message].length;
	}
}
