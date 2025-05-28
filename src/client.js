/**
 * @fileoverview The client API.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/** @typedef {import("./types.js").Strategy} Strategy */
/** @typedef {import("./types.js").PostOptions} PostOptions */
/** @typedef {import("./types.js").PostToOptions} PostToOptions */
/** @typedef {import("./types.js").PostToEntry} PostToEntry */
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
	 * The name of the strategy that produced this response.
	 * @type {string}
	 */
	name;

	/**
	 * The message posted.
	 * @type {Object}
	 */
	response;

	/**
	 * The URL of the posted message, if applicable.
	 * @type {string|undefined}
	 */
	url;

	/**
	 * Creates a new instance.
	 * @param {string} name The name of the strategy that produced this response.
	 * @param {Object} response The response.
	 * @param {string} [url] The URL of the posted message, if applicable.
	 */
	constructor(name, response, url) {
		this.name = name;
		this.response = response;
		this.url = url;
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
	 * The name of the strategy that produced this response.
	 * @type {string}
	 */
	name;

	/**
	 * The error or response.
	 * @type {Object}
	 */
	reason;

	/**
	 * Creates a new instance.
	 * @param {string} name The name of the strategy that produced this response.
	 * @param {Object} reason The reason for failure.
	 */
	constructor(name, reason) {
		this.name = name;
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
		).map((result, i) => {
			if (result.status === "fulfilled") {
				return new SuccessResponse(
					this.#strategies[i].name,
					result.value,
					this.#strategies[i].getUrlFromResponse?.(result.value),
				);
			} else {
				return new FailureResponse(
					this.#strategies[i].name,
					result.reason,
				);
			}
		});
	}

	/**
	 * Posts messages using specific strategies.
	 * @param {Array<PostToEntry>} entries An array of messages and their target strategies.
	 * @param {PostToOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<Array<SuccessResponse|FailureResponse>>} A promise that resolves with an array of results.
	 * @throws {TypeError} When `entries` is not an array.
	 * @throws {TypeError} When `entries` is an empty array.
	 * @throws {Error} When a strategy ID doesn't match any registered strategy.
	 */
	async postTo(entries, postOptions) {
		if (!Array.isArray(entries)) {
			throw new TypeError("Expected an array argument.");
		}

		if (entries.length === 0) {
			throw new TypeError("Expected at least one entry.");
		}

		// Validate all strategy IDs and create strategy-entry pairs
		const strategyEntryPairs = entries.map(entry => {
			const strategy = this.#strategies.find(
				s => s.id === entry.strategyId,
			);
			if (!strategy) {
				throw new Error(
					`Strategy with ID "${entry.strategyId}" not found.`,
				);
			}
			return { strategy, entry };
		});

		return (
			await Promise.allSettled(
				strategyEntryPairs.map(({ strategy, entry }) => {
					const { message, images } = entry;
					return strategy.post(message, {
						images,
						signal: postOptions?.signal,
					});
				}),
			)
		).map((result, i) => {
			const { strategy } = strategyEntryPairs[i];

			if (result.status === "fulfilled") {
				return new SuccessResponse(
					strategy.name,
					result.value,
					strategy.getUrlFromResponse?.(result.value),
				);
			} else {
				return new FailureResponse(strategy.name, result.reason);
			}
		});
	}
}
