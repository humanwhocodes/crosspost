/**
 * @fileoverview Discord strategy for posting messages.
 * @author Nicholas C. Zakas
 */

/* global fetch */

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

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
	 * The name of the strategy.
	 * @type {string}
	 * @readonly
	 */
	name = "discord";

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
	 * Posts a message to Discord.
	 * @param {string} message The message to post.
	 * @returns {Promise<DiscordMessageResponse>} A promise that resolves with the message data.
	 * @throws {Error} When the message fails to post.
	 */
	async post(message) {
		if (!message) {
			throw new TypeError("Missing message to post.");
		}

		const url = `${API_BASE}/channels/${this.#options.channelId}/messages`;
		const response = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bot ${this.#options.botToken}`,
				"Content-Type": "application/json",
				"User-Agent":
					"Crosspost CLI (https://github.com/humanwhocodes/crosspost, v0.7.0)", // x-release-please-version
			},
			body: JSON.stringify({
				content: message,
			}),
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
