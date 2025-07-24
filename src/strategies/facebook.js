/**
 * @fileoverview Facebook strategy for posting messages.
 * 
 * ## Facebook Graph API Integration
 * 
 * This strategy integrates with the Facebook Graph API to post messages and photos
 * to a user's Facebook feed.
 * 
 * ### Authentication Requirements
 * 
 * To use this strategy, you need:
 * 1. A Facebook App registered at https://developers.facebook.com/apps/
 * 2. An access token with appropriate permissions
 * 
 * ### Required Permissions
 * 
 * Your access token must have one of these permission sets:
 * - `pages_manage_posts` - For posting to Facebook Pages
 * - `publish_to_groups` - For posting to Facebook Groups
 * - User access token with appropriate scope for personal posts
 * 
 * ### Getting Access Tokens
 * 
 * For automated posting, you'll typically want a long-lived access token:
 * 1. Get a short-lived token using Facebook Login
 * 2. Exchange it for a long-lived token via the Graph API
 * 3. For pages, get a page access token that doesn't expire
 * 
 * See: https://developers.facebook.com/docs/facebook-login/manually-build-a-login-flow
 * 
 * ### Rate Limits
 * 
 * Facebook has rate limits for API calls:
 * - Standard: 200 calls per hour per user
 * - Higher limits available for verified apps
 * 
 * ### Best Practices
 * 
 * - Use long-lived or non-expiring tokens for automation
 * - Handle rate limiting gracefully with exponential backoff
 * - Keep images under 4MB for optimal performance
 * - Test with Facebook's Graph API Explorer before implementation
 * 
 * @author Nicholas C. Zakas
 */

/* global fetch, FormData, Blob, URLSearchParams */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { validatePostOptions } from "../util/options.js";
import { getImageMimeType } from "../util/images.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @typedef {Object} FacebookOptions
 * @property {string} accessToken The access token for the Facebook Graph API.
 */

/**
 * @typedef {Object} FacebookPostResponse
 * @property {string} id The ID of the newly created post.
 */

/**
 * @typedef {Object} FacebookPhotoResponse
 * @property {string} id The ID of the uploaded photo.
 * @property {string} post_id The ID of the post containing the photo.
 */

/**
 * @typedef {Object} FacebookErrorResponse
 * @property {Object} error The error object.
 * @property {string} error.message The error message.
 * @property {string} error.type The error type.
 * @property {number} error.code The error code.
 */

/** @typedef {import("../types.js").PostOptions} PostOptions */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const GRAPH_API_VERSION = "v18.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const POST_URL = `${BASE_URL}/me/feed`;
const PHOTO_URL = `${BASE_URL}/me/photos`;

/**
 * Creates a post on Facebook.
 * @param {string} accessToken The access token for the Facebook Graph API.
 * @param {string} message The message to post.
 * @param {PostOptions} [postOptions] Additional options for the post.
 * @returns {Promise<FacebookPostResponse>} A promise that resolves with the post data.
 */
async function createPost(accessToken, message, postOptions) {
	// If there are images, we need to use the photos endpoint instead
	if (postOptions?.images?.length) {
		// For now, Facebook API handles single image per post well
		// Multiple images would require more complex album logic
		const image = postOptions.images[0];
		
		const formData = new FormData();
		formData.append("message", message);
		formData.append("access_token", accessToken);
		formData.append("source", new Blob([image.data], { 
			type: getImageMimeType(image.data) 
		}));

		const response = await fetch(PHOTO_URL, {
			method: "POST",
			body: formData,
			signal: postOptions?.signal,
		});

		if (!response.ok) {
			const errorResponse = /** @type {FacebookErrorResponse} */ (
				await response.json()
			);
			throw new Error(
				`${response.status} Failed to create photo post: ${errorResponse.error.message}`,
			);
		}

		return /** @type {Promise<FacebookPhotoResponse>} */ (response.json());
	}

	// For text-only posts, use the feed endpoint
	const params = new URLSearchParams({
		message,
		access_token: accessToken,
	});

	const response = await fetch(POST_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: params.toString(),
		signal: postOptions?.signal,
	});

	if (!response.ok) {
		const errorResponse = /** @type {FacebookErrorResponse} */ (
			await response.json()
		);
		throw new Error(
			`${response.status} Failed to create post: ${errorResponse.error.message}`,
		);
	}

	return /** @type {Promise<FacebookPostResponse>} */ (response.json());
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A strategy for posting messages to Facebook.
 */
export class FacebookStrategy {
	/**
	 * The ID of the strategy.
	 * @type {string}
	 * @readonly
	 */
	id = "facebook";

	/**
	 * The display name of the strategy.
	 * @type {string}
	 * @readonly
	 */
	name = "Facebook";

	/**
	 * Maximum length of a Facebook post in characters.
	 * Facebook is quite generous with character limits.
	 * @type {number}
	 * @const
	 */
	MAX_MESSAGE_LENGTH = 63206;

	/**
	 * Options for this instance.
	 * @type {FacebookOptions}
	 */
	#options;

	/**
	 * Creates a new instance.
	 * @param {FacebookOptions} options Options for the instance.
	 * @throws {TypeError} When required options are missing.
	 */
	constructor(options) {
		const { accessToken } = options;

		if (!accessToken) {
			throw new TypeError("Missing access token.");
		}

		this.#options = options;
	}

	/**
	 * Posts a message to Facebook.
	 * @param {string} message The message to post.
	 * @param {PostOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<FacebookPostResponse|FacebookPhotoResponse>} A promise that resolves with the post data.
	 * @throws {TypeError} If message is missing.
	 */
	async post(message, postOptions) {
		if (!message) {
			throw new TypeError("Missing message to post.");
		}

		validatePostOptions(postOptions);

		return createPost(this.#options.accessToken, message, postOptions);
	}

	/**
	 * Extracts a URL from a Facebook API response.
	 * @param {FacebookPostResponse|FacebookPhotoResponse} response The response from the Facebook API post request.
	 * @returns {string} The URL for the Facebook post.
	 */
	getUrlFromResponse(response) {
		if (!response?.id) {
			throw new Error("Post ID not found in response");
		}

		// Handle photo response which has post_id
		const postId = /** @type {FacebookPhotoResponse} */ (response).post_id || response.id;
		
		// Facebook post ID format is typically {user-id}_{post-id}
		// The URL format is https://www.facebook.com/{user-id}/posts/{post-id}
		if (postId.includes("_")) {
			const [userId, actualPostId] = postId.split("_");
			return `https://www.facebook.com/${userId}/posts/${actualPostId}`;
		}

		// Fallback for different ID formats
		return `https://www.facebook.com/posts/${postId}`;
	}

	/**
	 * Calculates the length of a message according to Facebook's algorithm.
	 * Facebook counts all Unicode characters as is.
	 * @param {string} message The message to calculate the length of.
	 * @returns {number} The calculated length of the message.
	 */
	calculateMessageLength(message) {
		return [...message].length;
	}
}