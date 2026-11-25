/**
 * @fileoverview Reddit strategy for posting messages.
 * @author Nicholas C. Zakas
 */

/* global fetch, URLSearchParams */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { validatePostOptions } from "../util/options.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/** @typedef {import("../types.js").PostOptions} PostOptions */

/**
 * @typedef {Object} RedditOptions
 * @property {string} accessToken The OAuth access token for the Reddit API.
 * @property {string} subreddit The subreddit to post to (without the `r/` prefix).
 */

/** @typedef {[string, string, string]} RedditErrorEntry */

/**
 * @typedef {Object} RedditSubmitResponse
 * @property {Object} json The response body from Reddit.
 * @property {Array<RedditErrorEntry>} json.errors Any API validation errors.
 * @property {Object} [json.data] Information about the submitted post.
 * @property {string} [json.data.url] The canonical URL of the submitted post.
 * @property {string} [json.data.permalink] The permalink path for the submitted post.
 */

//-----------------------------------------------------------------------------
// Constants
//-----------------------------------------------------------------------------

const API_BASE = "https://oauth.reddit.com";

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * Formats Reddit API errors into a single string.
 * @param {Array<RedditErrorEntry>} errors The Reddit API errors.
 * @returns {string} The formatted error message.
 */
function formatErrors(errors) {
	return errors.map(error => error.filter(Boolean).join(": ")).join("\n");
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A strategy for posting messages to Reddit.
 */
export class RedditStrategy {
	/**
	 * The ID of the strategy.
	 * @type {string}
	 * @readonly
	 */
	id = "reddit";

	/**
	 * The display name of the strategy.
	 * @type {string}
	 * @readonly
	 */
	name = "Reddit";

	/**
	 * Maximum length of a Reddit self-post message in characters.
	 * @type {number}
	 * @const
	 */
	MAX_MESSAGE_LENGTH = 40300;

	/**
	 * Options for this instance.
	 * @type {RedditOptions}
	 */
	#options;

	/**
	 * Creates a new instance.
	 * @param {RedditOptions} options Options for the instance.
	 * @throws {Error} When options are missing.
	 */
	constructor(options) {
		const { accessToken, subreddit } = options;

		if (!accessToken) {
			throw new TypeError("Missing access token.");
		}

		if (!subreddit) {
			throw new TypeError("Missing subreddit.");
		}

		this.#options = options;
	}

	/**
	 * Posts a message to Reddit as a self post.
	 * The first line of the message is used as the title.
	 * Remaining lines are used as the post body.
	 * @param {string} message The message to post.
	 * @param {PostOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<RedditSubmitResponse>} A promise that resolves with the Reddit API response.
	 */
	async post(message, postOptions) {
		if (!message) {
			throw new TypeError("Missing message to post.");
		}

		validatePostOptions(postOptions);

		if (postOptions?.images?.length) {
			throw new Error("Images are not supported in Reddit text posts.");
		}

		const [firstLine, ...remainingLines] = message.split(/\r?\n/g);
		const title = firstLine.trim();
		const text = remainingLines.join("\n").trim();
		const body = new URLSearchParams({
			api_type: "json",
			kind: "self",
			sr: this.#options.subreddit,
			title,
			text,
			resubmit: "true",
		});

		const response = await fetch(`${API_BASE}/api/submit`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.#options.accessToken}`,
				"Content-Type": "application/x-www-form-urlencoded",
				"User-Agent":
					"Crosspost (https://github.com/humanwhocodes/crosspost, v1.0.4)", // x-release-please-version
			},
			body,
			signal: postOptions?.signal,
		});

		const result = /** @type {RedditSubmitResponse} */ (await response.json());
		const errors = result.json?.errors ?? [];

		if (!response.ok) {
			const errorMessage = errors.length
				? formatErrors(errors)
				: "Unknown Reddit API error.";
			throw new Error(
				`${response.status} Failed to submit post: ${response.statusText}\n${errorMessage}`,
			);
		}

		if (errors.length) {
			throw new Error(`Failed to submit post:\n${formatErrors(errors)}`);
		}

		return result;
	}

	/**
	 * Extracts a URL from a Reddit API response.
	 * @param {RedditSubmitResponse} response The response from the Reddit API.
	 * @returns {string} The URL of the Reddit post.
	 */
	getUrlFromResponse(response) {
		const { url, permalink } = response?.json?.data ?? {};
		const postUrl = url ?? permalink;

		if (!postUrl) {
			throw new Error("Post URL not found in response");
		}

		return postUrl.startsWith("http")
			? postUrl
			: `https://reddit.com${postUrl}`;
	}

	/**
	 * Calculates the length of a message according to Reddit's algorithm.
	 * All Unicode characters are counted as is.
	 * @param {string} message The message to calculate the length of.
	 * @returns {number} The calculated length of the message.
	 */
	calculateMessageLength(message) {
		return [...message].length;
	}
}
