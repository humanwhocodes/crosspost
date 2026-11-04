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
import { postThreadEntries, validateThreadEntries } from "../util/threads.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/** @typedef {import("../types.js").PostOptions} PostOptions */
/** @typedef {import("../types.js").PostThreadEntry} PostThreadEntry */
/** @typedef {import("../types.js").PostThreadOptions} PostThreadOptions */

/**
 * @typedef {Object} TelegramOptions
 * @property {string} botToken The Telegram bot token.
 * @property {string} chatId The Telegram chat ID to post to.
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
	 * Maximum length of a Telegram message in characters.
	 * @type {number}
	 * @const
	 */
	MAX_MESSAGE_LENGTH = 4096;

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
		const { botToken, chatId } = options;

		if (!botToken) {
			throw new TypeError("Missing bot token.");
		}

		if (!chatId) {
			throw new TypeError("Missing chat ID.");
		}

		this.#options = options;
	}

	/**
	 * Sends a text message to Telegram.
	 * @param {string} chatId The chat ID to send to.
	 * @param {string} text The text to send.
	 * @param {PostOptions} [postOptions] Additional options for the post.
	 * @param {number} [replyToMessageId] The ID of the message to reply to.
	 * @returns {Promise<TelegramMessageResponse>} A promise that resolves with the message data.
	 * @throws {Error} When the message fails to post.
	 */
	async #sendText(chatId, text, postOptions, replyToMessageId) {
		const url = `${API_BASE}${this.#options.botToken}/sendMessage`;
		/** @type {Record<string, unknown>} */
		const payload = {
			chat_id: chatId,
			text,
		};

		if (replyToMessageId) {
			payload.reply_parameters = { message_id: replyToMessageId };
		}

		const body = JSON.stringify(payload);

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"User-Agent": "Crosspost v1.0.4", // x-release-please-version
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
	 * @param {number} [replyToMessageId] The ID of the message to reply to.
	 * @returns {Promise<TelegramMessageResponse>} A promise that resolves with the message data.
	 * @throws {Error} When the image fails to post.
	 */
	async #sendImage(
		chatId,
		imageData,
		caption,
		postOptions,
		replyToMessageId,
	) {
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

		if (replyToMessageId) {
			formData.append(
				"reply_parameters",
				JSON.stringify({ message_id: replyToMessageId }),
			);
		}

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"User-Agent":
					"Crosspost CLI (https://github.com/humanwhocodes/crosspost, v1.0.4)", // x-release-please-version
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

		return this.#sendMessage(message, postOptions);
	}

	/**
	 * Posts a thread of messages to Telegram. Each message is sent as a reply
	 * to the previous one.
	 * @param {Array<PostThreadEntry>} entries The messages to post, in order.
	 * @param {PostThreadOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<Array<TelegramMessageResponse>>} A promise that resolves with the text message data for each entry.
	 * @throws {TypeError} When an entry is invalid. Nothing is posted in that case.
	 * @throws {ThreadError} When a message fails to post.
	 */
	async postThread(entries, postOptions) {
		validateThreadEntries(entries);

		return postThreadEntries(entries, postOptions, (entry, previous) =>
			this.#sendMessage(
				entry.message,
				{ images: entry.images, signal: postOptions?.signal },
				previous.at(-1)?.result.message_id,
			),
		);
	}

	/**
	 * Sends a text message followed by one message per image.
	 * @param {string} message The message to send.
	 * @param {PostOptions} [postOptions] Additional options for the post.
	 * @param {number} [replyToMessageId] The ID of the message to reply to.
	 *      When set, the images reply to the text message so they stay in the
	 *      thread.
	 * @returns {Promise<TelegramMessageResponse>} A promise that resolves with the text message data.
	 * @throws {Error} When a message fails to send.
	 */
	async #sendMessage(message, postOptions, replyToMessageId) {
		const chatId = this.#options.chatId;
		const textResult = await this.#sendText(
			chatId,
			message,
			postOptions,
			replyToMessageId,
		);

		for (const image of postOptions?.images ?? []) {
			await this.#sendImage(
				chatId,
				image.data,
				image.alt || "Image",
				postOptions,
				replyToMessageId ? textResult.result.message_id : undefined,
			);
		}

		return textResult;
	}

	/**
	 * Extracts a URL from a Telegram API response.
	 * @param {TelegramMessageResponse} response The response from the Telegram API post request.
	 * @returns {string} The URL for the Telegram message.
	 */
	getUrlFromResponse(response) {
		if (!response?.result?.message_id || !response?.result?.chat?.id) {
			throw new Error("Message ID or Chat ID not found in response");
		}

		return `https://t.me/c/${response.result.chat.id.toString().replace("-100", "")}/${response.result.message_id}`;
	}

	/**
	 * Calculates the length of a message according to Telegram's algorithm.
	 * All Unicode characters are counted as is.
	 * @param {string} message The message to calculate the length of.
	 * @returns {number} The calculated length of the message.
	 */
	calculateMessageLength(message) {
		return [...message].length;
	}
}
