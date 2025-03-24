/**
 * @fileoverview The client API.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/** @typedef {import("./types.js").Strategy} Strategy */
/** @typedef {import("./types.js").PostOptions} PostOptions */
/**
 * @typedef {Object} ClientOptions
 * @property {Array<Strategy>} strategies An array of strategies to use.
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * Represents a successful response.
 */
export class SuccessResponse {
	/**
	 * Indicates success.
	 * @type {boolean}
	 * @const
	 */
	ok = true;

	/**
	 * The message posted.
	 * @type {Object}
	 */
	response;

	/**
	 * Creates a new instance.
	 * @param {Object} response The response.
	 */
	constructor(response) {
		this.response = response;
	}
}

/**
 * Represents a failure response.
 */
export class FailureResponse {
	/**
	 * Indicates failure.
	 * @type {boolean}
	 * @const
	 */
	ok = false;

	/**
	 * The error or response.
	 * @type {Object}
	 */
	reason;

	/**
	 * Creates a new instance.
	 * @param {Object} reason The reason for failure.
	 */
	constructor(reason) {
		this.reason = reason;
	}
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * Represents a client that can post messages using different strategies.
 */
export class Client {
	/**
	 * The strategies to use.
	 * @type {Array<Strategy>}
	 */
	#strategies = [];

	/**
	 * Creates a new instance.
	 * @param {ClientOptions} options Options for the instance.
	 * @throws {TypeError} When options are missing or invalid.
	 */
	constructor(options) {
		this.#strategies = options.strategies;

		if (!Array.isArray(this.#strategies)) {
			throw new TypeError("strategies must be an array.");
		}

		if (!this.#strategies.length) {
			throw new TypeError("No strategies provided.");
		}
	}

	/**
	 * Posts a message using all strategies.
	 * @param {string} message The message to post.
	 * @param {PostOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<Array<SuccessResponse|FailureResponse>>} A promise that resolves with an array of results.
	 */
	async post(message, postOptions) {
		return (
			await Promise.allSettled(
				this.#strategies.map(strategy => {
					return strategy.post(message, postOptions);
				}),
			)
		).map(result => {
			if (result.status === "fulfilled") {
				return new SuccessResponse(result.value);
			} else {
				return new FailureResponse(result.reason);
			}
		});
	}
}
