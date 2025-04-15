/**
 * @fileoverview Telegram strategy for posting messages.
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
 * @typedef {Object} TelegramOptions
 * @property {string} botToken The Telegram bot token.
 * @property {string} [chatId] The Telegram chat ID to post to. If not provided, will attempt to get updates and use the first chat ID.
 */

/**
 * @typedef {Object} TelegramMessageResponse
 * @property {boolean} ok Whether the request was successful.
 * @property {TelegramMessage} result The message data.
 */

/**
 * @typedef {Object} TelegramMessage
 * @property {number} message_id The message ID.
 * @property {TelegramChat} chat The chat the message was sent to.
 * @property {string} text The text of the message.
 */

/**
 * @typedef {Object} TelegramChat
 * @property {number} id The chat ID.
 * @property {string} type The type of chat.
 */

/**
 * @typedef {Object} TelegramErrorResponse
 * @property {boolean} ok Whether the request was successful.
 * @property {number} error_code The error code.
 * @property {string} description The error description.
 */

/**
 * @typedef {Object} TelegramUpdateResponse
 * @property {boolean} ok Whether the request was successful.
 * @property {Array<TelegramUpdate>} result The array of updates.
 */

/**
 * @typedef {Object} TelegramUpdate
 * @property {number} update_id The update ID.
 * @property {TelegramMessage} [message] The message data.
 */

//-----------------------------------------------------------------------------
// Constants
//-----------------------------------------------------------------------------

const API_BASE = "https://api.telegram.org/bot";

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A strategy for posting messages to Telegram.
 */
export class TelegramStrategy {
	/**
	 * The ID of the strategy.
	 * @type {string}
	 * @readonly
	 */
	id = "telegram";

	/**
	 * The display name of the strategy.
	 * @type {string}
	 * @readonly
	 */
	name = "Telegram";

	/**
	 * Options for this instance.
	 * @type {TelegramOptions}
	 */
	#options;

	/**
	 * Creates a new instance.
	 * @param {TelegramOptions} options Options for the instance.
	 * @throws {Error} When options are missing.
	 */
	constructor(options) {
		const { botToken } = options;

		if (!botToken) {
			throw new TypeError("Missing bot token.");
		}

		this.#options = options;
	}

	/**
	 * Gets the chat ID to post to.
	 * @returns {Promise<string>} A promise that resolves with the chat ID.
	 * @throws {Error} When the chat ID cannot be determined.
	 */
	async #getChatId() {
		// If chat ID is provided, use it
		if (this.#options.chatId) {
			return this.#options.chatId;
		}

		// Otherwise, try to get updates to find a chat ID
		const url = `${API_BASE}${this.#options.botToken}/getUpdates`;
		const response = await fetch(url);

		if (!response.ok) {
			const errorResponse = /** @type {TelegramErrorResponse} */ (
				await response.json()
			);

			throw new Error(
				`${response.status} Failed to get updates: ${response.statusText}\n${errorResponse.description} (code: ${errorResponse.error_code})`,
			);
		}

		const updateResponse = /** @type {TelegramUpdateResponse} */ (
			await response.json()
		);

		if (!updateResponse.ok) {
			throw new Error("Failed to get updates from Telegram API.");
		}

		// Find the first update with a message
		const update = updateResponse.result.find(update => update.message);

		if (!update?.message?.chat?.id) {
			throw new Error(
				"No chat ID found. Please message your bot first or provide a chat ID in the options.",
			);
		}

		return String(update.message.chat.id);
	}

	/**
	 * Sends a text message to Telegram.
	 * @param {string} chatId The chat ID to send to.
	 * @param {string} text The text to send.
	 * @param {PostOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<TelegramMessageResponse>} A promise that resolves with the message data.
	 * @throws {Error} When the message fails to post.
	 */
	async #sendText(chatId, text, postOptions) {
		const url = `${API_BASE}${this.#options.botToken}/sendMessage`;
		const body = JSON.stringify({
			chat_id: chatId,
			text,
		});

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"User-Agent": "Crosspost v0.10.0", // x-release-please-version
			},
			body,
			signal: postOptions?.signal,
		});

		if (!response.ok) {
			const errorResponse = /** @type {TelegramErrorResponse} */ (
				await response.json()
			);

			throw new Error(
				`${response.status} Failed to post message: ${response.statusText}\n${errorResponse.description} (code: ${errorResponse.error_code})`,
			);
		}

		return /** @type {TelegramMessageResponse} */ (await response.json());
	}

	/**
	 * Sends an image to Telegram.
	 * @param {string} chatId The chat ID to send to.
	 * @param {Uint8Array} imageData The image data to send.
	 * @param {string} caption The caption for the image.
	 * @param {PostOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<TelegramMessageResponse>} A promise that resolves with the message data.
	 * @throws {Error} When the image fails to post.
	 */
	async #sendImage(chatId, imageData, caption, postOptions) {
		const url = `${API_BASE}${this.#options.botToken}/sendPhoto`;
		const type = getImageMimeType(imageData);
		const formData = new FormData();

		formData.append("chat_id", chatId);
		formData.append(
			"photo",
			new Blob([imageData], { type }),
			`image.${type.split("/")[1]}`,
		);

		if (caption) {
			formData.append("caption", caption);
		}

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"User-Agent":
					"Crosspost CLI (https://github.com/humanwhocodes/crosspost, v0.10.0)", // x-release-please-version
			},
			body: formData,
			signal: postOptions?.signal,
		});

		if (!response.ok) {
			const errorResponse = /** @type {TelegramErrorResponse} */ (
				await response.json()
			);

			throw new Error(
				`${response.status} Failed to post image: ${response.statusText}\n${errorResponse.description} (code: ${errorResponse.error_code})`,
			);
		}

		return /** @type {TelegramMessageResponse} */ (await response.json());
	}

	/**
	 * Posts a message to Telegram.
	 * @param {string} message The message to post.
	 * @param {PostOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<TelegramMessageResponse>} A promise that resolves with the message data.
	 * @throws {Error} When the message fails to post.
	 */
	async post(message, postOptions) {
		if (!message) {
			throw new TypeError("Missing message to post.");
		}

		validatePostOptions(postOptions);

		const chatId = await this.#getChatId();

		// If there are images, send each as a separate message
		if (postOptions?.images?.length) {
			const results = [];

			// First send the text message
			const textResult = await this.#sendText(
				chatId,
				message,
				postOptions,
			);
			results.push(textResult);

			// Then send each image
			for (const image of postOptions.images) {
				const imageResult = await this.#sendImage(
					chatId,
					image.data,
					image.alt || "Image",
					postOptions,
				);
				results.push(imageResult);
			}

			// Return the text message response as the result
			return textResult;
		} else {
			// Just send text
			return this.#sendText(chatId, message, postOptions);
		}
	}
}
