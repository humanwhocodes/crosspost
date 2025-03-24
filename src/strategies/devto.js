/**
 * @fileoverview Dev.to strategy for posting articles.
 * @author Nicholas C. Zakas
 */

/* global fetch, Buffer */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { getImageMimeType } from "../util/images.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @typedef {Object} DevtoOptions
 * @property {string} apiKey The Dev.to API key.
 */

/**
 * @typedef {Object} DevtoArticle
 * @property {string} title The title of the article.
 * @property {string} body_markdown The markdown content of the article.
 * @property {boolean} published Whether the article is published.
 * @property {string[]} tags The tags for the article.
 */

/**
 * @typedef {Object} DevtoErrorResponse
 * @property {string} error The error message.
 * @property {string} status The error status.
 */

/**
 * @typedef {import("../types.js").PostOptions} PostOptions
 */

//-----------------------------------------------------------------------------
// Constants
//-----------------------------------------------------------------------------

const API_URL = "https://dev.to/api";

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * Posts an article to Dev.to.
 * @param {string} apiKey The Dev.to API key.
 * @param {string} content The content to post.
 * @param {PostOptions} [postOptions] Additional options for the post.
 * @returns {Promise<DevtoArticle>} A promise that resolves with the article data.
 */
async function postArticle(apiKey, content, postOptions) {
	let articleContent = content;

	// if there are images, append them to the content
	if (postOptions?.images?.length) {
		articleContent += "\n\n";
		for (const image of postOptions.images) {
			const base64 = Buffer.from(image.data).toString("base64");
			const mimeType = getImageMimeType(image.data);
			articleContent += `![${image.alt || ""}](data:${mimeType};base64,${base64})\n\n`;
		}
	}

	const response = await fetch(`${API_URL}/articles`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"api-key": apiKey,
			"User-Agent": "Crosspost v0.7.0", // x-release-please-version
		},
		body: JSON.stringify({
			article: {
				title: content.split(/\r?\n/g)[0],
				body_markdown: articleContent,
				published: true,
			},
		}),
		signal: postOptions?.signal,
	});

	if (response.ok) {
		return /** @type {Promise<DevtoArticle>} */ (response.json());
	}

	const errorBody = /** @type {DevtoErrorResponse} */ (await response.json());

	throw new Error(
		`${response.status} ${response.statusText}: Failed to post article:\n${errorBody.status} - ${errorBody.error}`,
	);
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A strategy for posting articles to Dev.to.
 */
export class DevtoStrategy {
	/**
	 * The name of the strategy.
	 * @type {string}
	 * @readonly
	 */
	name = "devto";

	/**
	 * The API key for Dev.to.
	 * @type {string}
	 */
	#apiKey;

	/**
	 * Creates a new instance.
	 * @param {DevtoOptions} options Options for the instance.
	 * @throws {Error} When options are missing.
	 */
	constructor(options) {
		const { apiKey } = options;

		if (!apiKey) {
			throw new TypeError("Missing apiKey.");
		}

		this.#apiKey = apiKey;
	}

	/**
	 * Posts an article to Dev.to.
	 * @param {string} message The message to post.
	 * @param {PostOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<DevtoArticle>} A promise that resolves with the article data.
	 */
	async post(message, postOptions) {
		if (!message) {
			throw new TypeError("Missing message to post.");
		}

		return postArticle(this.#apiKey, message, postOptions);
	}
}
