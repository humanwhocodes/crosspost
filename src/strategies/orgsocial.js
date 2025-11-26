/**
 * @fileoverview Org Social strategy for posting messages.
 * @author Andros Fenollosa
 */

/* global fetch, FormData, Blob, setTimeout */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { validatePostOptions } from "../util/options.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/** @typedef {import("../types.js").PostOptions} PostOptions */

/**
 * @typedef {Object} OrgSocialOptions
 * @property {string} vfile The virtual file URL with authentication token.
 * @property {string} publicUrl The public URL of the social.org file.
 * @property {string} [host="host.org-social.org"] The Org Social Host instance (defaults to official host).
 */

/**
 * @typedef {Object} OrgSocialErrorResponse
 * @property {string} type The response type (e.g., "Error").
 * @property {Array<string>} errors Array of error messages.
 */

/**
 * @typedef {Object} OrgSocialResponseData
 * @property {string} message Success message.
 * @property {string} public-url The public URL of the social.org file.
 */

/**
 * @typedef {Object} OrgSocialSuccessResponse
 * @property {string} type The response type (e.g., "Success").
 * @property {Array<string>} errors Empty array for successful requests.
 * @property {OrgSocialResponseData} data Response data.
 */

/**
 * @typedef {Object} OrgSocialPost
 * @property {string} id The RFC 3339 timestamp ID of the post.
 * @property {string} content The content of the post.
 * @property {Record<string, string>} [properties] Additional properties for the post.
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * Formats a date to RFC 3339 format with timezone offset.
 * @param {Date} date The date to format.
 * @returns {string} The formatted date string (e.g., "2025-01-26T12:00:00+0100").
 */
function formatRFC3339(date) {
	/**
	 * Pads a number with leading zeros.
	 * @param {number} num The number to pad.
	 * @returns {string} The padded string.
	 */
	const pad = num => String(num).padStart(2, "0");

	const year = date.getFullYear();
	const month = pad(date.getMonth() + 1);
	const day = pad(date.getDate());
	const hours = pad(date.getHours());
	const minutes = pad(date.getMinutes());
	const seconds = pad(date.getSeconds());

	// Get timezone offset in format +HHMM or -HHMM
	const tzOffset = -date.getTimezoneOffset();
	const tzSign = tzOffset >= 0 ? "+" : "-";
	const tzHours = pad(Math.floor(Math.abs(tzOffset) / 60));
	const tzMinutes = pad(Math.abs(tzOffset) % 60);

	return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${tzSign}${tzHours}${tzMinutes}`;
}

/**
 * Downloads the current social.org file from the host.
 * @param {string} publicUrl The public URL of the social.org file.
 * @param {AbortSignal} [signal] The abort signal for the request.
 * @returns {Promise<string>} A promise that resolves with the file content.
 */
async function downloadSocialFile(publicUrl, signal) {
	const response = await fetch(publicUrl, {
		method: "GET",
		signal,
	});

	if (response.ok) {
		return response.text();
	}

	// If file doesn't exist yet (404), return a minimal template
	if (response.status === 404) {
		return `#+TITLE: My Org Social
#+NICK: user

* Posts
`;
	}

	try {
		const errorBody = /** @type {OrgSocialErrorResponse} */ (
			await response.json()
		);
		throw new Error(
			`${response.status} ${response.statusText}: Failed to download social.org:\n${errorBody.errors.join(", ")}`,
		);
	} catch {
		throw new Error(
			`${response.status} ${response.statusText}: Failed to download social.org`,
		);
	}
}

/**
 * Creates a new post entry in Org Mode format.
 * @param {OrgSocialPost} post The post data.
 * @returns {string} The formatted post entry.
 */
function createPostEntry(post) {
	let entry = "**\n";
	entry += ":PROPERTIES:\n";
	entry += `:ID: ${post.id}\n`;

	// Add any additional properties
	if (post.properties) {
		for (const [key, value] of Object.entries(post.properties)) {
			entry += `:${key.toUpperCase()}: ${value}\n`;
		}
	}

	entry += ":END:\n";
	entry += `${post.content}\n`;

	return entry;
}

/**
 * Inserts a new post into the social.org file content.
 * Posts are added at the end of the file, after the last post.
 * First post has no blank line before it, subsequent posts have one blank line.
 * @param {string} content The current file content.
 * @param {OrgSocialPost} post The post to insert.
 * @returns {string} The updated file content.
 */
function insertPost(content, post) {
	const postEntry = createPostEntry(post);

	// Find the "* Posts" section
	const postsRegex = /^(\* Posts)$/m;
	const match = content.match(postsRegex);

	if (match && match.index !== undefined) {
		// Get everything after "* Posts"
		const afterPosts = content.substring(match.index + match[0].length);

		// Remove ONLY empty ** at the very beginning (template marker)
		// Match: newline + "**" + optional whitespace + end of string (no more content)
		// Real posts will have \n**\n:PROPERTIES: so they won't match
		const cleanAfterPosts = afterPosts.replace(/^\n\*\*\s*$/, "");

		// Check if there are already posts with content
		const hasExistingPosts = /\*\*\s*\n:PROPERTIES:/m.test(cleanAfterPosts);

		// Reconstruct content
		const beforePosts = content.substring(0, match.index + match[0].length);

		if (hasExistingPosts) {
			// Already has posts, add blank line before new post
			return beforePosts + cleanAfterPosts + "\n" + postEntry;
		} else {
			// First post, no blank line
			return beforePosts + "\n" + postEntry;
		}
	}

	// If "* Posts" doesn't exist, add it at the end with the post (no blank line)
	return content + "\n* Posts\n" + postEntry;
}

/**
 * Uploads the updated social.org file to the host.
 * @param {OrgSocialOptions} options The strategy options.
 * @param {string} content The file content to upload.
 * @param {AbortSignal} [signal] The abort signal for the request.
 * @returns {Promise<OrgSocialSuccessResponse>} A promise that resolves with the upload response.
 */
async function uploadSocialFile(options, content, signal) {
	const uploadUrl = `https://${options.host}/upload`;

	const formData = new FormData();
	formData.append("vfile", options.vfile);
	formData.append(
		"file",
		new Blob([content], { type: "text/plain; charset=utf-8" }),
		"social.org",
	);

	const response = await fetch(uploadUrl, {
		method: "POST",
		body: formData,
		signal,
	});

	if (response.ok) {
		return /** @type {Promise<OrgSocialSuccessResponse>} */ (
			response.json()
		);
	}

	try {
		const errorBody = /** @type {OrgSocialErrorResponse} */ (
			await response.json()
		);
		throw new Error(
			`${response.status} ${response.statusText}: Failed to upload social.org:\n${errorBody.errors.join(", ")}`,
		);
	} catch {
		throw new Error(
			`${response.status} ${response.statusText}: Failed to upload social.org`,
		);
	}
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A strategy for posting messages to Org Social.
 */
export class OrgSocialStrategy {
	/**
	 * Maximum length of an Org Social post in characters.
	 * Org Social has no character limit.
	 * @type {number}
	 * @const
	 */
	MAX_MESSAGE_LENGTH = Infinity;

	/**
	 * The ID of the strategy.
	 * @type {string}
	 * @readonly
	 */
	id = "orgsocial";

	/**
	 * The display name of the strategy.
	 * @type {string}
	 * @readonly
	 */
	name = "Org Social";

	/**
	 * Options for this instance.
	 * @type {OrgSocialOptions}
	 */
	#options;

	/**
	 * Creates a new instance.
	 * @param {OrgSocialOptions} options Options for the instance.
	 * @throws {Error} When options are missing.
	 */
	constructor(options) {
		const { vfile, publicUrl } = options;

		if (!vfile) {
			throw new TypeError("Missing vfile.");
		}

		if (!publicUrl) {
			throw new TypeError("Missing publicUrl.");
		}

		// Set default host if not provided
		this.#options = {
			host: "host.org-social.org",
			...options,
		};
	}

	/**
	 * Calculates the length of a message according to Org Social's algorithm.
	 * Org Social counts all Unicode characters as-is.
	 * @param {string} message The message to calculate the length of.
	 * @returns {number} The calculated length of the message.
	 */
	calculateMessageLength(message) {
		return [...message].length;
	}

	/**
	 * Posts a message to Org Social.
	 * @param {string} message The message to post.
	 * @param {PostOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<OrgSocialSuccessResponse>} A promise that resolves with the upload response.
	 */
	async post(message, postOptions) {
		if (!message) {
			throw new TypeError("Missing message to post.");
		}

		validatePostOptions(postOptions);

		// Images are not supported in Org Social text posts
		if (postOptions?.images?.length) {
			throw new Error(
				"Images are not supported in Org Social posts. Consider adding image links in the message text.",
			);
		}

		// 1. Download current social.org file from public URL
		const currentContent = await downloadSocialFile(
			this.#options.publicUrl,
			postOptions?.signal,
		);

		// 2. Create new post with current timestamp
		// Add milliseconds to ensure unique IDs when posting multiple times quickly
		const now = new Date();
		let postId = formatRFC3339(now);

		// Check if this ID already exists in the content
		// If it does, wait 1 second and generate a new one
		while (currentContent.includes(`:ID: ${postId}`)) {
			await new Promise(resolve => setTimeout(resolve, 1000));
			postId = formatRFC3339(new Date());
		}

		const post = {
			id: postId,
			content: message,
		};

		// 3. Insert post into content
		const updatedContent = insertPost(currentContent, post);

		// 4. Upload updated content
		return uploadSocialFile(
			this.#options,
			updatedContent,
			postOptions?.signal,
		);
	}

	/**
	 * Extracts a URL from an Org Social Host API response.
	 * @param {OrgSocialSuccessResponse} response The response from the upload request.
	 * @returns {string} The URL for the Org Social post.
	 */
	getUrlFromResponse(response) {
		const publicUrl = response?.data?.["public-url"];
		if (!publicUrl) {
			throw new Error("Public URL not found in response");
		}

		// The public-url points to the social.org file
		// We return it as-is since Org Social doesn't have individual post URLs
		// Clients would need to fetch the file and find the post by ID
		return publicUrl;
	}
}
