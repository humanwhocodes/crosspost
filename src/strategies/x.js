/**
 * @fileoverview X (Twitter) strategy for posting messages.
 * @author Nicholas C. Zakas
 */

/* global fetch */

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @typedef {Object} XOptions
 * @property {string} accessToken The bearer token for authentication
 */

/**
 * @typedef {Object} XResponse
 * @property {Object} data The tweet data
 * @property {string} data.id The ID of the created tweet
 * @property {string} data.text The text of the tweet
 */

/**
 * @typedef {Object} XErrorResponse
 * @property {Array<Object>} errors The errors that occurred
 * @property {string} errors[].message The error message
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const TWEET_URL = "https://api.x.com/2/tweets";

/**
 * Posts a tweet to X.
 * @param {XOptions} options The options for the strategy.
 * @param {string} message The message to post.
 * @returns {Promise<XResponse>} A promise that resolves with the tweet data.
 */
async function postTweet(options, message) {
	const response = await fetch(TWEET_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${options.accessToken}`,
		},
		body: JSON.stringify({
			text: message,
		}),
	});

	if (response.ok) {
		return /** @type {Promise<XResponse>} */ (response.json());
	}

	const errorBody = /** @type {XErrorResponse} */ (await response.json());
	throw new Error(
		`${response.status} ${response.statusText}: Failed to post tweet:\n${
			errorBody.errors?.[0]?.message || "Unknown error"
		}`,
	);
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A strategy for posting messages to X (Twitter).
 */
export class XStrategy {
	/**
	 * The name of the strategy.
	 * @type {string}
	 * @readonly
	 */
	name = "x";

	/**
	 * Options for this instance.
	 * @type {XOptions}
	 */
	#options;

	/**
	 * Creates a new instance.
	 * @param {XOptions} options Options for the instance.
	 * @throws {Error} When options are missing.
	 */
	constructor(options) {
		const { accessToken } = options;

		if (!accessToken) {
			throw new TypeError("Missing access token.");
		}

		this.#options = options;
	}

	/**
	 * Posts a message to X.
	 * @param {string} message The message to post.
	 * @returns {Promise<XResponse>} A promise that resolves with the tweet data.
	 */
	async post(message) {
		if (!message) {
			throw new TypeError("Missing message to post.");
		}

		return postTweet(this.#options, message);
	}
}
