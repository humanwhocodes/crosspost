/**
 * @fileoverview Instagram strategy for posting content via Instagram Graph API.
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

/**
 * @typedef {Object} InstagramOptions
 * @property {string} accessToken The access token for the Instagram Graph API.
 * @property {string} instagramAccountId The Instagram Business Account ID.
 * @property {(image: import("../types.js").ImageEmbed, accessToken: string, signal?: AbortSignal) => Promise<string>} [uploadImageFn] Custom function to upload images and return public URLs. If not provided, will throw an error requiring manual upload.
 */

/**
 * @typedef {Object} InstagramMediaContainerResponse
 * @property {string} id The ID of the created media container.
 */

/**
 * @typedef {Object} InstagramPublishResponse
 * @property {string} id The ID of the published media.
 */

/**
 * @typedef {Object} InstagramErrorResponse
 * @property {Object} error The error object.
 * @property {string} error.message The error message.
 * @property {string} error.type The error type.
 * @property {number} error.code The error code.
 * @property {string} error.error_subcode The error subcode.
 * @property {string} error.fbtrace_id The Facebook trace ID for debugging.
 */

/** @typedef {import("../types.js").PostOptions} PostOptions */

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A strategy for posting to Instagram via the Instagram Graph API.
 * 
 * **Requirements:**
 * - Instagram Business Account (personal accounts not supported)
 * - Facebook App with Instagram permissions
 * - `instagram_content_publish` permission
 * - Valid OAuth access token
 * 
 * **Limitations:**
 * - Only supports Instagram Business accounts
 * - Images must be JPEG or PNG format
 * - Images must be at least 320px and at most 8192px on any side
 * - Aspect ratio must be between 4:5 and 1.91:1
 * - File size must be under 8MB for images
 * - Rate limits: 200 requests per hour per user
 * - Content must comply with Instagram Community Guidelines
 * 
 * **Authentication:**
 * Requires OAuth 2.0 authentication flow:
 * 1. Register Facebook App at https://developers.facebook.com/apps/
 * 2. Add Instagram Basic Display product
 * 3. Configure OAuth redirect URIs
 * 4. Request `instagram_content_publish` permission
 * 5. Complete OAuth flow to get access token
 * 
 * @see https://developers.facebook.com/docs/instagram-api/guides/content-publishing/
 * @see https://developers.facebook.com/docs/facebook-login/manually-build-a-login-flow
 * @see https://developers.facebook.com/docs/apps/
 */
export class InstagramStrategy {
	/**
	 * The ID of the strategy.
	 * @type {string}
	 * @readonly
	 */
	id = "instagram";

	/**
	 * The display name of the strategy.
	 * @type {string}
	 * @readonly
	 */
	name = "Instagram";

	/**
	 * Options for this instance.
	 * @type {InstagramOptions}
	 */
	#options;

	/**
	 * Custom upload function for images.
	 * @type {Function|undefined}
	 */
	#uploadImageFn;

	/**
	 * Creates a new instance.
	 * @param {InstagramOptions} options Options for the instance.
	 * @throws {TypeError} When required options are missing.
	 */
	constructor(options) {
		const { accessToken, instagramAccountId, uploadImageFn } = options;

		if (!accessToken) {
			throw new TypeError("Missing Instagram access token.");
		}

		if (!instagramAccountId) {
			throw new TypeError("Missing Instagram account ID.");
		}

		this.#options = options;
		this.#uploadImageFn = uploadImageFn;
	}

	/**
	 * Posts content to Instagram.
	 * 
	 * Instagram posting is a two-step process:
	 * 1. Create a media container with the content
	 * 2. Publish the media container to make it live
	 * 
	 * @param {string} message The caption text for the Instagram post.
	 * @param {PostOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<InstagramPublishResponse>} A promise that resolves with the published media data.
	 * @throws {TypeError} When message is missing or invalid.
	 * @throws {Error} When posting fails due to API errors.
	 */
	async post(message, postOptions) {
		if (!message) {
			throw new TypeError("Missing message for Instagram post.");
		}

		validatePostOptions(postOptions);

		const { accessToken, instagramAccountId } = this.#options;

		postOptions?.signal?.throwIfAborted();

		// Step 1: Create media container
		let mediaContainerId;

		if (postOptions?.images?.length) {
			// Post with image
			if (postOptions.images.length > 1) {
				throw new Error("Instagram strategy currently supports only single image posts.");
			}

			const image = postOptions.images[0];
			
			// First upload the image to get a media URL
			const imageUrl = await this.#uploadImage(image, accessToken, postOptions?.signal);
			
			// Create media container with image
			mediaContainerId = await this.#createMediaContainer(
				message,
				imageUrl,
				accessToken,
				instagramAccountId,
				postOptions?.signal
			);
		} else {
			// Text-only posts are not supported by Instagram API
			throw new Error("Instagram requires at least one image. Text-only posts are not supported.");
		}

		postOptions?.signal?.throwIfAborted();

		// Step 2: Publish the media container
		const publishResponse = await this.#publishMediaContainer(
			mediaContainerId,
			accessToken,
			instagramAccountId,
			postOptions?.signal
		);

		return publishResponse;
	}

	/**
	 * Uploads an image and returns a URL that can be used for creating media containers.
	 * 
	 * @param {import("../types.js").ImageEmbed} image The image to upload.
	 * @param {string} accessToken The access token.
	 * @param {AbortSignal} [signal] Optional abort signal.
	 * @returns {Promise<string>} The URL of the uploaded image.
	 * @private
	 */
	async #uploadImage(image, accessToken, signal) {
		if (this.#uploadImageFn) {
			return await this.#uploadImageFn(image, accessToken, signal);
		}

		// In a real implementation, you would upload the image to a CDN or file hosting service
		// and return the public URL. For this example, we'll throw an error to indicate
		// this step needs to be implemented by the user.
		throw new Error(
			"Image upload not implemented. Instagram requires images to be uploaded to a publicly accessible URL first. " +
			"Please upload your image to a CDN or file hosting service and provide the URL directly."
		);
	}

	/**
	 * Creates a media container for the Instagram post.
	 * 
	 * @param {string} caption The caption text.
	 * @param {string} imageUrl The URL of the image.
	 * @param {string} accessToken The access token.
	 * @param {string} instagramAccountId The Instagram account ID.
	 * @param {AbortSignal} [signal] Optional abort signal.
	 * @returns {Promise<string>} The ID of the created media container.
	 * @private
	 */
	async #createMediaContainer(caption, imageUrl, accessToken, instagramAccountId, signal) {
		signal?.throwIfAborted();

		const url = `https://graph.facebook.com/v21.0/${instagramAccountId}/media`;
		const body = new URLSearchParams({
			image_url: imageUrl,
			caption: caption,
			access_token: accessToken,
		});

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: body.toString(),
			signal,
		});

		const data = await response.json();

		if (!response.ok) {
			const error = /** @type {InstagramErrorResponse} */ (data);
			throw new Error(
				`Failed to create Instagram media container: ${error.error?.message || response.statusText}`
			);
		}

		const mediaResponse = /** @type {InstagramMediaContainerResponse} */ (data);
		return mediaResponse.id;
	}

	/**
	 * Publishes a media container to make it live on Instagram.
	 * 
	 * @param {string} creationId The ID of the media container to publish.
	 * @param {string} accessToken The access token.
	 * @param {string} instagramAccountId The Instagram account ID.
	 * @param {AbortSignal} [signal] Optional abort signal.
	 * @returns {Promise<InstagramPublishResponse>} The published media data.
	 * @private
	 */
	async #publishMediaContainer(creationId, accessToken, instagramAccountId, signal) {
		signal?.throwIfAborted();

		const url = `https://graph.facebook.com/v21.0/${instagramAccountId}/media_publish`;
		const body = new URLSearchParams({
			creation_id: creationId,
			access_token: accessToken,
		});

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: body.toString(),
			signal,
		});

		const data = await response.json();

		if (!response.ok) {
			const error = /** @type {InstagramErrorResponse} */ (data);
			throw new Error(
				`Failed to publish Instagram media: ${error.error?.message || response.statusText}`
			);
		}

		return /** @type {InstagramPublishResponse} */ (data);
	}

	/**
	 * Extracts a URL from an Instagram API response.
	 * @param {InstagramPublishResponse} response The response from the Instagram API publish request.
	 * @returns {string} The URL for the Instagram post.
	 */
	getUrlFromResponse(response) {
		if (!response?.id) {
			throw new Error("Instagram media ID not found in response");
		}

		// Instagram post URLs follow this format: https://www.instagram.com/p/{shortcode}/
		// However, the API returns a media ID, not a shortcode. The conversion from media ID
		// to shortcode requires additional API calls or complex algorithms.
		// For now, we'll return a generic Instagram URL that users can use to find their post.
		return `https://www.instagram.com/p/${response.id}`;
	}

	/**
	 * Maximum length of an Instagram caption in characters.
	 * @type {number}
	 * @const
	 */
	MAX_MESSAGE_LENGTH = 2200;

	/**
	 * Calculates the length of a message according to Instagram's algorithm.
	 * Instagram counts all characters including emojis, spaces, and line breaks.
	 * Hashtags and mentions count toward the character limit.
	 * 
	 * @param {string} message The message to calculate the length of.
	 * @returns {number} The calculated length of the message.
	 */
	calculateMessageLength(message) {
		// Instagram counts all Unicode characters including emojis
		return [...message].length;
	}
}