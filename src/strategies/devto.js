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
 *
 * @typedef {Object} DevtoArticle
 * @property {string} title The title of the article.
 * @property {string} body_markdown The markdown content of the article.
 * @property {boolean} published Whether the article is published.
 * @property {string[]} tags The tags for the article.
 *
 * @typedef {Object} DevToUser
 * @property {string} name The name of the user.
 * @property {string} username The username of the user.
 * @property {string|null} twitter_username The Twitter username of the user.
 * @property {string|null} github_username The GitHub username of the user.
 * @property {number} user_id The ID of the user.
 * @property {string|null} website_url The website URL of the user.
 * @property {string} profile_image The profile image URL of the user.
 * @property {string} profile_image_90 The profile image URL of the user (90px).
 *
 * @typedef {Object} DevToPostResponse
 * @property {string} type_of The type of post (e.g., "article").
 * @property {number} id The ID of the article.
 * @property {string} title The title of the article.
 * @property {string} description The description of the article.
 * @property {string} readable_publish_date The human-readable publish date.
 * @property {string} slug The slug of the article.
 * @property {string} path The path of the article.
 * @property {string} url The full URL of the article.
 * @property {number} comments_count The number of comments.
 * @property {number} public_reactions_count The number of public reactions.
 * @property {number} collection_id The collection ID of the article.
 * @property {string} published_timestamp The publish timestamp.
 * @property {number} positive_reactions_count The number of positive reactions.
 * @property {string|null} cover_image The cover image URL.
 * @property {string|null} social_image The social image URL.
 * @property {string|null} canonical_url The canonical URL.
 * @property {string} created_at The creation timestamp.
 * @property {string|null} edited_at The last edit timestamp.
 * @property {string|null} crossposted_at The crosspost timestamp.
 * @property {string} published_at The publish timestamp.
 * @property {string} last_comment_at The last comment timestamp.
 * @property {number} reading_time_minutes The reading time in minutes.
 * @property {string} tag_list The comma-separated list of tags.
 * @property {string[]} tags The array of tags.
 * @property {string} body_html The HTML content of the article.
 * @property {string} body_markdown The markdown content of the article.
 * @property {DevToUser} user The user who created the article.
 *
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
	 * Maximum length of a Dev.to article (no strict limit).
	 * @type {number}
	 * @const
	 */
	MAX_MESSAGE_LENGTH = Infinity;

	/**
	 * The ID of the strategy.
	 * @type {string}
	 * @readonly
	 */
	id = "devto";

	/**
	 * The display name of the strategy.
	 * @type {string}
	 * @readonly
	 */
	name = "Dev.to";

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

	/**
	 * Extracts a URL from a Dev.to API response.
	 * @param {DevToPostResponse} response The response from the Dev.to API post request.
	 * @returns {string} The URL for the Dev.to article.
	 */
	getUrlFromResponse(response) {
		if (!response || !response.id) {
			throw new Error("Article ID not found in response");
		}

		// If url is directly available in the response, use that
		if (response.url) {
			return response.url;
		}

		// If canonical_url is available, use that
		if (response.canonical_url) {
			return response.canonical_url;
		}

		// Fall back to constructing a URL from the ID
		return `https://dev.to/articles/${response.id}`;
	}

	/**
	 * Calculates the length of a message for Dev.to.
	 * Dev.to has no strict character limit for articles, but this returns the character count.
	 * @param {string} message The message to calculate the length of.
	 * @returns {number} The calculated length of the message.
	 */
	calculateMessageLength(message) {
		return [...message].length;
	}
}
