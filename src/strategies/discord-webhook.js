/**
 * @fileoverview Discord webhook strategy for posting messages.
 * @author Nicholas C. Zakas
 */

/* global fetch */

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
 */

/**
 * @typedef {Object} DiscordWebhookErrorResponse
 * @property {number} code The error code.
 * @property {string} message The error message.
 */

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A strategy for posting messages to Discord via webhooks.
 */
export class DiscordWebhookStrategy {
	/**
	 * The name of the strategy.
	 * @type {string}
	 * @readonly
	 */
	name = "discord-webhook";

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
	 * @returns {Promise<DiscordWebhookResponse>} A promise that resolves with the message data.
	 * @throws {Error} When the message fails to post.
	 */
	async post(message) {
		if (!message) {
			throw new TypeError("Missing message to post.");
		}

		// Tell Discord to wait until the message is posted to return a response
		const url = new URL(this.#webhookUrl);
		url.searchParams.set("wait", "true");

		const response = await fetch(url.href, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"User-Agent":
					"Crosspost CLI (https://github.com/humanwhocodes/crosspost, v0.6.3)", // x-release-please-version
			},
			body: JSON.stringify({
				content: message,
			}),
		});

		if (!response.ok) {
			const errorResponse = /** @type {DiscordWebhookErrorResponse} */ (
				await response.json()
			);

			throw new Error(
				`${response.status} Failed to post message: ${response.statusText}\n${errorResponse.message} (code: ${errorResponse.code})`,
			);
		}

		return /** @type {Promise<DiscordWebhookResponse>} */ (response.json());
	}
}
