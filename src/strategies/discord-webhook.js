/**
 * @fileoverview Discord webhook strategy for posting messages.
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

/**
 * @typedef {Object} DiscordWebhookOptions
 * @property {string} webhookUrl The Discord webhook URL.
 */

/**
 * @typedef {Object} DiscordWebhookResponse
 * @property {string} id The ID of the created message.
 * @property {string} channel_id The ID of the channel the message was posted to.
 * @property {string} content The content of the message.
 * @property {string} timestamp The timestamp of the message.
 * @property {string} webhook_id The ID of the webhook that posted the message.
 * @property {number} type The type of the message.
 * @property {string} [guild_id] The ID of the guild the message was posted to (optional).
 */

/**
 * @typedef {Object} DiscordWebhookErrorResponse
 * @property {number} code The error code.
 * @property {string} message The error message.
 */

/** @typedef {import("../types.js").PostOptions} PostOptions */

/**
 * @typedef {Object} DiscordPayload
 * @property {string} content The text content of the message
 * @property {DiscordEmbed[]} [embeds] Array of embedded messages
 * @property {DiscordMessageReference} [message_reference] Reference to another message
 * @property {DiscordAttachment[]} [attachments] Array of file attachments
 */

/**
 * @typedef {Object} DiscordEmbedImage
 * @property {string} url URL of the image
 */

/**
 * @typedef {Object} DiscordEmbed
 * @property {string} [title] The title of the embed
 * @property {string} [description] The description of the embed
 * @property {DiscordEmbedImage} [thumbnail] The thumbnail image
 * @property {DiscordEmbedImage} [image] The main image
 */

/**
 * @typedef {Object} DiscordMessageReference
 * @property {string} message_id The ID of the message being referenced
 */

/**
 * @typedef {Object} DiscordAttachment
 * @property {number} id The unique identifier for the attachment
 * @property {string} description A description of the attachment
 * @property {string} filename The filename of the attachment
 */

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A strategy for posting messages to Discord via webhooks.
 */
export class DiscordWebhookStrategy {
	/**
	 * The ID of the strategy.
	 * @type {string}
	 * @readonly
	 */
	id = "discord-webhook";

	/**
	 * The display name of the strategy.
	 * @type {string}
	 * @readonly
	 */
	name = "Discord Webhook";

	/**
	 * The webhook URL for this instance.
	 * @type {string}
	 */
	#webhookUrl;

	/**
	 * Creates a new instance.
	 * @param {DiscordWebhookOptions} options Options for the instance.
	 * @throws {Error} When options are missing.
	 */
	constructor(options) {
		const { webhookUrl } = options;

		if (!webhookUrl) {
			throw new TypeError("Missing webhook URL.");
		}

		this.#webhookUrl = webhookUrl;
	}

	/**
	 * Posts a message to Discord.
	 * @param {string} message The message to post.
	 * @param {PostOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<DiscordWebhookResponse>} A promise that resolves with the message data.
	 * @throws {Error} When the message fails to post.
	 */
	async post(message, postOptions) {
		if (!message) {
			throw new TypeError("Missing message to post.");
		}

		validatePostOptions(postOptions);

		// Tell Discord to wait until the message is posted to return a response
		const url = new URL(this.#webhookUrl);
		url.searchParams.set("wait", "true");

		const formData = new FormData();

		/** @type {DiscordPayload} */
		const payload = {
			content: message,
		};

		// Add images if present
		if (postOptions?.images?.length) {
			payload.embeds = [];
			payload.attachments = [];

			/*
			 * Each image needs to be added in three places:
			 * 1. As a file field in FormData
			 * 2. As an embed image in the payload
			 * 3. As an attachment in the payload
			 */
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

		// Add payload as JSON string
		formData.append("payload_json", JSON.stringify(payload));

		const response = await fetch(url.href, {
			method: "POST",
			headers: {
				"User-Agent":
					"Crosspost (https://github.com/humanwhocodes/crosspost, v0.11.1)", // x-release-please-version
			},
			body: formData,
			signal: postOptions?.signal,
		});

		if (!response.ok) {
			const errorResponse = /** @type {DiscordWebhookErrorResponse} */ (
				await response.json()
			);

			throw new Error(
				`${response.status} Failed to post message: ${response.statusText}\n${errorResponse.message} (code: ${errorResponse.code})`,
			);
		}

		// fetch the webhook info to see if we can get the guild_id

		return /** @type {Promise<DiscordWebhookResponse>} */ (response.json());
	}
}
