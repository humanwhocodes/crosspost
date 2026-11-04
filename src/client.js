/**
 * @fileoverview The client API.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import {
	ThreadError,
	joinThreadEntries,
	validateThreadEntries,
} from "./util/threads.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/** @typedef {import("./types.js").Strategy} Strategy */
/** @typedef {import("./types.js").PostOptions} PostOptions */
/** @typedef {import("./types.js").PostToOptions} PostToOptions */
/** @typedef {import("./types.js").PostToEntry} PostToEntry */
/** @typedef {import("./types.js").PostThreadEntry} PostThreadEntry */
/** @typedef {import("./types.js").PostThreadOptions} PostThreadOptions */
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
	 * The URLs of every post in a thread, in order, if applicable.
	 * @type {Array<string>|undefined}
	 */
	urls;

	/**
	 * Creates a new instance.
	 * @param {string} name The name of the strategy that produced this response.
	 * @param {Object} response The response.
	 * @param {string} [url] The URL of the posted message, if applicable.
	 * @param {Array<string>} [urls] The URLs of every post in a thread, if applicable.
	 */
	constructor(name, response, url, urls) {
		this.name = name;
		this.response = response;
		this.url = url;
		this.urls = urls;
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
	 * The URLs of the posts in a thread that were published before the
	 * failure, if applicable.
	 * @type {Array<string>|undefined}
	 */
	urls;

	/**
	 * Creates a new instance.
	 * @param {string} name The name of the strategy that produced this response.
	 * @param {Object} reason The reason for failure.
	 * @param {Array<string>} [urls] The URLs of thread posts published before the failure.
	 */
	constructor(name, reason, urls) {
		this.name = name;
		this.reason = reason;
		this.urls = urls;
	}
}

/**
 * Gets the URLs for thread posts. A URL problem shouldn't turn published
 * posts into a failure, so errors are ignored.
 * @param {Strategy} strategy The strategy that posted the thread.
 * @param {Array<any>} responses The response for each post.
 * @returns {Array<string>|undefined} The URLs, or undefined if they can't be determined.
 */
function getThreadUrls(strategy, responses) {
	if (!strategy.getUrlFromResponse) {
		return undefined;
	}

	try {
		return responses.map(response =>
			/** @type {(response: any) => string} */ (
				strategy.getUrlFromResponse
			)(response),
		);
	} catch {
		return undefined;
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

	/**
	 * Posts a thread of messages using all strategies. Strategies with a
	 * `postThread()` method post each message as a reply to the previous one.
	 * Other strategies post all of the messages combined into a single post.
	 *
	 * For a successful thread, `response` is an array with one response per
	 * post, `url` is the URL of the first post, and `urls` has the URL of
	 * every post. If a thread stops partway through, `reason` is a
	 * `ThreadError` and `urls` has the URLs of the posts that were published.
	 * @param {Array<PostThreadEntry>} entries An array of messages to post as a thread.
	 * @param {PostThreadOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<Array<SuccessResponse|FailureResponse>>} A promise that resolves with an array of results.
	 * @throws {TypeError} When `entries` is not an array.
	 * @throws {TypeError} When `entries` is an empty array.
	 * @throws {TypeError} When an entry is invalid. Nothing is posted in that case.
	 */
	async postThread(entries, postOptions) {
		validateThreadEntries(entries);

		return (
			await Promise.allSettled(
				this.#strategies.map(async strategy => {
					if (strategy.postThread) {
						return strategy.postThread(entries, postOptions);
					}

					// the service can't reply to posts, so post the thread as one message
					const { message, images } = joinThreadEntries(entries);

					return [
						await strategy.post(message, {
							images: /** @type {PostOptions["images"]} */ (
								images
							),
							signal: postOptions?.signal,
						}),
					];
				}),
			)
		).map((result, i) => {
			const strategy = this.#strategies[i];

			if (result.status === "fulfilled") {
				const responses = Array.isArray(result.value)
					? result.value
					: [result.value];
				const urls = getThreadUrls(strategy, responses);

				return new SuccessResponse(
					strategy.name,
					responses,
					urls?.[0],
					urls,
				);
			}

			const urls =
				result.reason instanceof ThreadError &&
				result.reason.responses.length
					? getThreadUrls(strategy, result.reason.responses)
					: undefined;

			return new FailureResponse(strategy.name, result.reason, urls);
		});
	}
}
