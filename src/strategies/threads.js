/**
 * @fileoverview Threads strategy for posting messages.
 * @author Nicholas C. Zakas
 */

/* global fetch */

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @typedef {Object} ThreadsOptions
 * @property {string} accessToken The access token for the Threads API.
 * @property {string} instagramId The Instagram account ID.
 */

/**
 * @typedef {Object} ThreadsErrorResponse
 * @property {Object} error The error information.
 * @property {string} error.message The error message.
 * @property {string} error.type The error type.
 * @property {number} error.code The error code.
 * @property {Object} error.error_subcode Optional error subcode.
 */

//-----------------------------------------------------------------------------
// Constants
//-----------------------------------------------------------------------------

const API_VERSION = "v22.0";
const BASE_URL = "https://graph.facebook.com";

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * Posts a message to Threads.
 * @param {ThreadsOptions} options The options for posting.
 * @param {string} message The message to post.
 * @returns {Promise<Object>} A promise that resolves with the post data.
 */
async function createPost(options, message) {
	const url = `${BASE_URL}/${API_VERSION}/${options.instagramId}/threads`;

	const response = await fetch(url, {
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
		return response.json();
	}

	const errorBody = /** @type {ThreadsErrorResponse} */ (
		await response.json()
	);

	throw new Error(
		`${response.status} Failed to create post: ${errorBody.error.message}`,
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
	 * The name of the strategy.
	 * @type {string}
	 * @readonly
	 */
	name = "threads";

	/**
	 * Options for this instance.
	 * @type {ThreadsOptions}
	 */
	#options;

	/**
	 * Creates a new instance.
	 * @param {ThreadsOptions} options Options for the instance.
	 * @throws {TypeError} When required options are missing.
	 */
	constructor(options) {
		const { accessToken, instagramId } = options;

		if (!accessToken) {
			throw new TypeError("Missing access token.");
		}

		if (!instagramId) {
			throw new TypeError("Missing Instagram ID.");
		}

		this.#options = options;
	}

	/**
	 * Posts a message to Threads.
	 * @param {string} message The message to post.
	 * @returns {Promise<Object>} A promise that resolves with the post data.
	 * @throws {TypeError} If message is missing.
	 */
	async post(message) {
		if (!message) {
			throw new TypeError("Missing message to post.");
		}

		return createPost(this.#options, message);
	}
}
