/**
 * @fileoverview Slack strategy for posting messages.
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
 * @typedef {Object} SlackOptions
 * @property {string} botToken The Slack bot token.
 * @property {string} channel The Slack channel ID or name to post to.
 */

/**
 * @typedef {Object} SlackMessageResponse
 * @property {boolean} ok Whether the request was successful.
 * @property {string} channel The channel ID where the message was posted.
 * @property {string} ts The timestamp of the message.
 * @property {SlackMessage} message The message data.
 */

/**
 * @typedef {Object} SlackMessage
 * @property {string} text The text of the message.
 * @property {string} user The user ID who posted the message.
 * @property {string} ts The timestamp of the message.
 */

/**
 * @typedef {Object} SlackErrorResponse
 * @property {boolean} ok Whether the request was successful (false for errors).
 * @property {string} error The error code.
 */

/**
 * @typedef {Object} SlackUploadURLResponse
 * @property {boolean} ok Whether the request was successful.
 * @property {string} upload_url The URL to upload the file to.
 * @property {string} file_id The file ID for completing the upload.
 */

/**
 * @typedef {Object} SlackUploadCompleteResponse
 * @property {boolean} ok Whether the request was successful.
 * @property {SlackFileInfo[]} files The uploaded file information.
 */

/**
 * @typedef {Object} SlackFileInfo
 * @property {string} id The file ID.
 * @property {string} title The file title.
 * @property {string} permalink The permanent link to the file.
 */

/**
 * @typedef {Object} SlackUploadResponse
 * @property {boolean} ok Whether the request was successful.
 * @property {SlackFile} file The uploaded file data.
 */

/**
 * @typedef {Object} SlackFile
 * @property {string} id The file ID.
 * @property {string} name The file name.
 * @property {string} permalink The permanent link to the file.
 */

//-----------------------------------------------------------------------------
// Constants
//-----------------------------------------------------------------------------

const API_BASE = "https://slack.com/api";

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A strategy for posting messages to Slack.
 */
export class SlackStrategy {
	/**
	 * Maximum length of a Slack message in characters.
	 * @type {number}
	 * @const
	 */
	MAX_MESSAGE_LENGTH = 4000;

	/**
	 * The ID of the strategy.
	 * @type {string}
	 * @readonly
	 */
	id = "slack";

	/**
	 * The display name of the strategy.
	 * @type {string}
	 * @readonly
	 */
	name = "Slack";

	/**
	 * The options for this strategy.
	 * @type {SlackOptions}
	 */
	#options;

	/**
	 * Creates a new instance.
	 * @param {SlackOptions} options Options for the instance.
	 * @throws {Error} When options are missing.
	 */
	constructor(options) {
		const { botToken, channel } = options;

		if (!botToken) {
			throw new TypeError("Missing bot token.");
		}

		if (!channel) {
			throw new TypeError("Missing channel.");
		}

		this.#options = options;
	}

	/**
	 * Calculates the length of a message according to Slack's algorithm.
	 * All characters are counted as is.
	 * @param {string} message The message to calculate the length of.
	 * @returns {number} The calculated length of the message.
	 */
	calculateMessageLength(message) {
		return [...message].length;
	}

	/**
	 * Uploads an image to Slack using the new three-step process.
	 * @param {Uint8Array} imageData The image data to upload.
	 * @param {string} filename The filename for the image.
	 * @param {string} [altText] The alt text for the image.
	 * @param {PostOptions} [postOptions] Additional options for the upload.
	 * @returns {Promise<SlackUploadResponse>} A promise that resolves with the upload response.
	 * @throws {Error} When the upload fails.
	 */
	async #uploadImage(imageData, filename, altText, postOptions) {
		const type = getImageMimeType(imageData);

		// Step 1: Get upload URL
		const uploadUrlResponse = await this.#getUploadURL(
			filename,
			imageData.length,
			altText,
			postOptions,
		);

		// Step 2: Upload file to the provided URL
		await this.#uploadFileToURL(
			uploadUrlResponse.upload_url,
			imageData,
			type,
			postOptions,
		);

		// Step 3: Complete the upload
		const completeResponse = await this.#completeUpload(
			[
				{
					id: uploadUrlResponse.file_id,
					title: filename,
				},
			],
			postOptions,
		);

		// Return in the expected format for backward compatibility
		return {
			ok: true,
			file: {
				id: completeResponse.files[0].id,
				name: filename,
				permalink: completeResponse.files[0].permalink,
			},
		};
	}

	/**
	 * Gets an upload URL from Slack.
	 * @param {string} filename The filename for the image.
	 * @param {number} length The file size in bytes.
	 * @param {string} [altText] The alt text for the image.
	 * @param {PostOptions} [postOptions] Additional options for the request.
	 * @returns {Promise<SlackUploadURLResponse>} A promise that resolves with the upload URL response.
	 * @throws {Error} When the request fails.
	 */
	async #getUploadURL(filename, length, altText, postOptions) {
		const url = `${API_BASE}/files.getUploadURLExternal`;
		const formData = new FormData();
		formData.append("filename", filename);
		formData.append("length", length.toString());

		if (altText) {
			formData.append("alt_text", altText);
		}

		const response = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.#options.botToken}`,
				"User-Agent":
					"Crosspost CLI (https://github.com/humanwhocodes/crosspost, v0.14.0)", // x-release-please-version
			},
			body: formData,
			signal: postOptions?.signal,
		});

		if (!response.ok) {
			throw new Error(
				`${response.status} Failed to get upload URL: ${response.statusText}`,
			);
		}

		const result = /** @type {SlackUploadURLResponse} */ (
			await response.json()
		);

		if (!result.ok) {
			const errorResponse = /** @type {SlackErrorResponse} */ (
				/** @type {unknown} */ (result)
			);
			throw new Error(`Failed to get upload URL: ${errorResponse.error}`);
		}

		return result;
	}

	/**
	 * Uploads file data to the provided upload URL.
	 * @param {string} uploadUrl The URL to upload the file to.
	 * @param {Uint8Array} imageData The image data to upload.
	 * @param {string} type The MIME type of the file.
	 * @param {PostOptions} [postOptions] Additional options for the request.
	 * @returns {Promise<void>} A promise that resolves when the upload completes.
	 * @throws {Error} When the upload fails.
	 */
	async #uploadFileToURL(uploadUrl, imageData, type, postOptions) {
		const response = await fetch(uploadUrl, {
			method: "POST",
			headers: {
				"User-Agent":
					"Crosspost CLI (https://github.com/humanwhocodes/crosspost, v0.14.0)", // x-release-please-version
			},
			body: new Blob([imageData], { type }),
			signal: postOptions?.signal,
		});

		if (!response.ok) {
			throw new Error(
				`${response.status} Failed to upload file: ${response.statusText}`,
			);
		}
	}

	/**
	 * Completes the file upload process.
	 * @param {Array<{id: string, title: string}>} files The files to complete.
	 * @param {PostOptions} [postOptions] Additional options for the request.
	 * @returns {Promise<SlackUploadCompleteResponse>} A promise that resolves with the completion response.
	 * @throws {Error} When the completion fails.
	 */
	async #completeUpload(files, postOptions) {
		const url = `${API_BASE}/files.completeUploadExternal`;
		const payload = {
			files,
		};

		const response = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.#options.botToken}`,
				"Content-Type": "application/json",
				"User-Agent":
					"Crosspost CLI (https://github.com/humanwhocodes/crosspost, v0.14.0)", // x-release-please-version
			},
			body: JSON.stringify(payload),
			signal: postOptions?.signal,
		});

		if (!response.ok) {
			throw new Error(
				`${response.status} Failed to complete upload: ${response.statusText}`,
			);
		}

		const result = /** @type {SlackUploadCompleteResponse} */ (
			await response.json()
		);

		if (!result.ok) {
			const errorResponse = /** @type {SlackErrorResponse} */ (
				/** @type {unknown} */ (result)
			);
			throw new Error(
				`Failed to complete upload: ${errorResponse.error}`,
			);
		}

		return result;
	}

	/**
	 * Posts a message to Slack.
	 * @param {string} message The message to post.
	 * @param {PostOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<SlackMessageResponse>} A promise that resolves with the message data.
	 * @throws {Error} When the message fails to post.
	 */
	async post(message, postOptions) {
		if (!message) {
			throw new TypeError("Missing message to post.");
		}

		validatePostOptions(postOptions);

		const url = `${API_BASE}/chat.postMessage`;
		/** @type {any} */
		const payload = {
			channel: this.#options.channel,
			text: message,
		};

		// Handle images if provided
		if (postOptions?.images?.length) {
			// For images, we need to upload them first and then share them
			const uploadPromises = postOptions.images.map(
				async (image, index) => {
					const filename = `image${index + 1}.${getImageMimeType(image.data).split("/")[1]}`;
					const uploadResult = await this.#uploadImage(
						image.data,
						filename,
						image.alt,
						postOptions,
					);
					return {
						permalink: uploadResult.file.permalink,
						alt: image.alt,
					};
				},
			);

			// Wait for all uploads to complete
			const uploadResults = await Promise.all(uploadPromises);

			// Add file permalinks to the message with alt text if provided
			const fileLinks = uploadResults
				.map(result =>
					result.alt
						? `${result.alt}: ${result.permalink}`
						: result.permalink,
				)
				.join("\n");
			payload.text = `${message}\n\n${fileLinks}`;
		}

		const response = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.#options.botToken}`,
				"Content-Type": "application/json",
				"User-Agent":
					"Crosspost CLI (https://github.com/humanwhocodes/crosspost, v0.14.0)", // x-release-please-version
			},
			body: JSON.stringify(payload),
			signal: postOptions?.signal,
		});

		if (!response.ok) {
			throw new Error(
				`${response.status} Failed to post message: ${response.statusText}`,
			);
		}

		const result = /** @type {SlackMessageResponse} */ (
			await response.json()
		);

		if (!result.ok) {
			const errorResponse = /** @type {SlackErrorResponse} */ (
				/** @type {unknown} */ (result)
			);
			throw new Error(`Failed to post message: ${errorResponse.error}`);
		}

		return result;
	}

	/**
	 * Gets the URL for a response.
	 * @param {SlackMessageResponse} response The response from posting.
	 * @returns {string} The URL for the message.
	 */
	getUrlFromResponse(response) {
		// Slack doesn't provide direct message URLs in the API response
		// We construct it from the channel and timestamp
		const channelId = response.channel;

		// For public channels, we can construct a URL
		// For private channels or DMs, this may not work as expected
		return `https://slack.com/app_redirect?channel=${channelId}&message_ts=${response.ts}`;
	}
}
