/**
 * @fileoverview Discord strategy for posting messages.
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
 * @typedef {Object} DiscordOptions
 * @property {string} botToken The Discord bot token.
 * @property {string} channelId The Discord channel ID to post to.
 */

/**
 * @typedef {Object} DiscordMessageResponse
 * @property {string} id The ID of the created message.
 * @property {string} channel_id The ID of the channel the message was posted to.
 * @property {string} content The content of the message.
 */

/**
 * @typedef {Object} DiscordErrorResponse
 * @property {number} code The error code.
 * @property {string} message The error message.
 */

/**
 * @typedef {Object} DiscordPayload
 * @property {string} content The text content of the message
 * @property {DiscordEmbed[]} [embeds] Array of embedded messages
 * @property {DiscordMessageReference} [message_reference] Reference to the message being replied to
 * @property {DiscordAttachment[]} [attachments] Array of file attachments
 */

/**
 * @typedef {Object} DiscordMessageReference
 * @property {string} message_id The ID of the message being referenced
 */

/**
 * @typedef {Object} DiscordEmbedImage
 * @property {string} url URL of the image
 */

/**
 * @typedef {Object} DiscordEmbed
 * @property {string} [description] The description of the embed
 * @property {DiscordEmbedImage} [image] The main image
 */

/**
 * @typedef {Object} DiscordAttachment
 * @property {number} id The unique identifier for the attachment
 * @property {string} description A description of the attachment
 * @property {string} filename The filename of the attachment
 */

//-----------------------------------------------------------------------------
// Constants
//-----------------------------------------------------------------------------

const API_BASE = "https://discord.com/api/v10";

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A strategy for posting messages to Discord.
 */
export class DiscordStrategy {
	/**
	 * Maximum length of a Discord message in characters.
	 * @type {number}
	 * @const
	 */
	MAX_MESSAGE_LENGTH = 2000;

	/**
	 * The ID of the strategy.
	 * @type {string}
	 * @readonly
	 */
	id = "discord";

	/**
	 * The display name of the strategy.
	 * @type {string}
	 * @readonly
	 */
	name = "Discord Bot";

	/**
	 * Options for this instance.
	 * @type {DiscordOptions}
	 */
	#options;

	/**
	 * Creates a new instance.
	 * @param {DiscordOptions} options Options for the instance.
	 * @throws {Error} When options are missing.
	 */
	constructor(options) {
		const { botToken, channelId } = options;

		if (!botToken) {
			throw new TypeError("Missing bot token.");
		}

		if (!channelId) {
			throw new TypeError("Missing channel ID.");
		}

		this.#options = options;
	}

	/**
	 * Calculates the length of a message according to Discord's algorithm.
	 * All characters are counted as is.
	 * @param {string} message The message to calculate the length of.
	 * @returns {number} The calculated length of the message.
	 */
	calculateMessageLength(message) {
		return [...message].length;
	}

	/**
	 * Posts a message to Discord.
	 * @param {string} message The message to post.
	 * @param {PostOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<DiscordMessageResponse>} A promise that resolves with the message data.
	 * @throws {Error} When the message fails to post.
	 */
	async post(message, postOptions) {
		if (!message) {
			throw new TypeError("Missing message to post.");
		}

		validatePostOptions(postOptions);

		return this.#createMessage(message, postOptions);
	}

	/**
	 * Posts a thread of messages to Discord. Each message is sent as a reply
	 * to the previous one.
	 * @param {Array<PostThreadEntry>} entries The messages to post, in order.
	 * @param {PostThreadOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<Array<DiscordMessageResponse>>} A promise that resolves with the data for each message.
	 * @throws {TypeError} When an entry is invalid. Nothing is posted in that case.
	 * @throws {ThreadError} When a message fails to post.
	 */
	async postThread(entries, postOptions) {
		validateThreadEntries(entries);

		return postThreadEntries(entries, postOptions, (entry, previous) =>
			this.#createMessage(
				entry.message,
				{ images: entry.images, signal: postOptions?.signal },
				previous.at(-1)?.id,
			),
		);
	}

	/**
	 * Creates a message in the channel.
	 * @param {string} message The message to post.
	 * @param {PostOptions} [postOptions] Additional options for the post.
	 * @param {string} [replyToMessageId] The ID of the message to reply to.
	 * @returns {Promise<DiscordMessageResponse>} A promise that resolves with the message data.
	 * @throws {Error} When the message fails to post.
	 */
	async #createMessage(message, postOptions, replyToMessageId) {
		const url = `${API_BASE}/channels/${this.#options.channelId}/messages`;
		const formData = new FormData();

		/** @type {DiscordPayload} */
		const payload = {
			content: message,
		};

		if (replyToMessageId) {
			payload.message_reference = { message_id: replyToMessageId };
		}

		if (postOptions?.images?.length) {
			payload.embeds = [];
			payload.attachments = [];

			postOptions.images.forEach((image, index) => {
				const type = getImageMimeType(image.data);
				const filename = `image${index + 1}.${type.split("/")[1]}`;
				const description = image.alt || filename;
				const file = new Blob([image.data], { type });
				formData.append(`files[${index}]`, file, filename);

				payload.attachments?.push({
					id: index,
					description,
					filename,
				});

				payload.embeds?.push({
					description,
					image: {
						url: `attachment://${filename}`,
					},
				});
			});
		}

		formData.append("payload_json", JSON.stringify(payload));

		const response = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bot ${this.#options.botToken}`,
				"User-Agent":
					"Crosspost (https://github.com/humanwhocodes/crosspost, v1.0.4)", // x-release-please-version
			},
			body: formData,
			signal: postOptions?.signal,
		});

		if (!response.ok) {
			const errorResponse = /** @type {DiscordErrorResponse} */ (
				await response.json()
			);

			throw new Error(
				`${response.status} Failed to post message: ${response.statusText}\n${errorResponse.message} (code: ${errorResponse.code})`,
			);
		}

		return /** @type {Promise<DiscordMessageResponse>} */ (response.json());
	}
}
