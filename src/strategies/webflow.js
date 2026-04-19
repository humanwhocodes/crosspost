/**
 * @fileoverview Webflow strategy for posting content to CMS collections.
 * 
 * ## Webflow CMS API Integration
 * 
 * This strategy integrates with Webflow's CMS API v2 to create collection items.
 * It supports posting text content and uploading images as assets.
 * 
 * ### API Documentation References:
 * - Create Collection Items: https://developers.webflow.com/reference/create-new-collection-item
 * - OAuth Authentication: https://developers.webflow.com/docs/oauth
 * - Application Registration: https://developers.webflow.com/docs/apps
 * 
 * ### Authentication Requirements:
 * - OAuth 2.0 access token with appropriate scopes
 * - Application must be registered in Webflow Developer workspace
 * - Required scopes: cms:write, assets:write (for image uploads)
 * 
 * ### Rate Limits and Best Practices:
 * - Standard rate limits apply (typically 60 requests per minute)
 * - Use proper error handling for rate limit responses (429 status)
 * - Consider implementing exponential backoff for retries
 * - Images are uploaded as separate assets before being referenced in collection items
 * 
 * ### Configuration Requirements:
 * - accessToken: OAuth access token with appropriate permissions
 * - siteId: The ID of the Webflow site containing the target collection
 * - collectionId: The ID of the specific collection to post to
 * - Collection must have compatible field structure (text fields for content)
 * 
 * ### Limitations:
 * - Collection structure must be predefined in Webflow
 * - Field mapping is simplified (content goes to "content" field, images to "main-image" and "images")
 * - URL generation uses simplified pattern (may need custom domain configuration)
 * - No support for rich text formatting or embedded elements
 * 
 * @author Nicholas C. Zakas
 */

/* global fetch, FormData, Blob */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { validatePostOptions } from "../util/options.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @typedef {Object} WebflowOptions
 * @property {string} accessToken The OAuth access token for Webflow API.
 * @property {string} siteId The ID of the Webflow site.
 * @property {string} collectionId The ID of the collection to post to.
 * @property {string} [apiBaseUrl] The base URL for Webflow API (defaults to official API).
 */

/**
 * @typedef {Object} WebflowCollectionItem
 * @property {string} name The name/title of the collection item.
 * @property {string} slug The URL slug for the item.
 * @property {Object} fieldData Additional fields for the collection item.
 */

/**
 * @typedef {Object} WebflowResponse
 * @property {string} id The ID of the created collection item.
 * @property {string} slug The slug of the created item.
 * @property {string} [lastPublished] The last published date.
 * @property {Object} fieldData The field data of the created item.
 */

/**
 * @typedef {Object} WebflowAssetResponse
 * @property {string} id The ID of the uploaded asset.
 * @property {string} url The URL of the uploaded asset.
 * @property {string} displayName The display name of the asset.
 */

/**
 * @typedef {Object} WebflowErrorResponse
 * @property {string} message The error message.
 * @property {number} code The error code.
 * @property {Object} [details] Additional error details.
 */

/** @typedef {import("../types.js").PostOptions} PostOptions */

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A strategy for posting content to Webflow CMS collections.
 */
export class WebflowStrategy {
	/**
	 * Maximum length of a Webflow collection item name in characters.
	 * Based on Webflow's text field limits.
	 * @type {number}
	 * @const
	 */
	MAX_MESSAGE_LENGTH = 10000;

	/**
	 * The ID of the strategy.
	 * @type {string}
	 * @readonly
	 */
	id = "webflow";

	/**
	 * The display name of the strategy.
	 * @type {string}
	 * @readonly
	 */
	name = "Webflow";

	/**
	 * The OAuth access token for this instance.
	 * @type {string}
	 */
	#accessToken;

	/**
	 * The site ID for this instance.
	 * @type {string}
	 */
	#siteId;

	/**
	 * The collection ID for this instance.
	 * @type {string}
	 */
	#collectionId;

	/**
	 * The base URL for the Webflow API.
	 * @type {string}
	 */
	#apiBaseUrl;

	/**
	 * Creates a new instance.
	 * @param {WebflowOptions} options Options for the instance.
	 * @throws {TypeError} When required options are missing.
	 */
	constructor(options) {
		const { accessToken, siteId, collectionId, apiBaseUrl } = options;

		if (!accessToken) {
			throw new TypeError("Missing access token.");
		}

		if (!siteId) {
			throw new TypeError("Missing site ID.");
		}

		if (!collectionId) {
			throw new TypeError("Missing collection ID.");
		}

		this.#accessToken = accessToken;
		this.#siteId = siteId;
		this.#collectionId = collectionId;
		this.#apiBaseUrl = apiBaseUrl || "https://api.webflow.com/v2";
	}

	/**
	 * Calculates the length of a message according to Webflow's algorithm.
	 * All characters are counted as is.
	 * @param {string} message The message to calculate the length of.
	 * @returns {number} The calculated length of the message.
	 */
	calculateMessageLength(message) {
		return [...message].length;
	}

	/**
	 * Uploads an image as a Webflow asset.
	 * @param {import("../types.js").ImageEmbed} image The image to upload.
	 * @returns {Promise<WebflowAssetResponse>} A promise that resolves with the asset data.
	 * @throws {Error} When the upload fails.
	 */
	async #uploadImage(image) {
		const formData = new FormData();
		formData.append("file", new Blob([image.data]), "image.jpg");
		if (image.alt) {
			formData.append("displayName", image.alt);
		}

		const response = await fetch(`${this.#apiBaseUrl}/sites/${this.#siteId}/assets`, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${this.#accessToken}`,
				"User-Agent": "Crosspost (https://github.com/humanwhocodes/crosspost, v0.15.1)", // x-release-please-version
			},
			body: formData,
		});

		if (!response.ok) {
			const errorResponse = /** @type {WebflowErrorResponse} */ (
				await response.json()
			);

			throw new Error(
				`${response.status} Failed to upload image: ${response.statusText}\n${errorResponse.message}`,
			);
		}

		return /** @type {Promise<WebflowAssetResponse>} */ (response.json());
	}

	/**
	 * Creates a URL slug from a message.
	 * @param {string} message The message to create a slug from.
	 * @returns {string} A URL-safe slug.
	 */
	#createSlug(message) {
		return message
			.toLowerCase()
			.trim()
			.slice(0, 100) // Limit slug length
			.replace(/[^a-z0-9\s-]/g, "") // Remove special characters
			.replace(/\s+/g, "-") // Replace spaces with hyphens
			.replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
			.replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
	}

	/**
	 * Posts content to a Webflow CMS collection.
	 * @param {string} message The message/content to post.
	 * @param {PostOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<WebflowResponse>} A promise that resolves with the collection item data.
	 * @throws {Error} When the post fails to create.
	 */
	async post(message, postOptions) {
		if (!message) {
			throw new TypeError("Missing message to post.");
		}

		validatePostOptions(postOptions);

		// Create the collection item payload
		const slug = this.#createSlug(message);
		
		/** @type {WebflowCollectionItem} */
		const payload = {
			name: message.slice(0, 256), // Limit name length for Webflow
			slug: slug || `post-${Date.now()}`, // Fallback slug if creation fails
			fieldData: {
				content: message,
			},
		};

		// Upload images if present and add them to field data
		if (postOptions?.images?.length) {
			const imageUploads = postOptions.images.map(image => this.#uploadImage(image));
			const uploadedImages = await Promise.all(imageUploads);
			
			// Add the first image as a main image field (common Webflow pattern)
			if (uploadedImages[0]) {
				payload.fieldData["main-image"] = uploadedImages[0].id;
			}
			
			// Add all images as an array if the collection supports it
			payload.fieldData.images = uploadedImages.map(img => img.id);
		}

		const response = await fetch(
			`${this.#apiBaseUrl}/collections/${this.#collectionId}/items`,
			{
				method: "POST",
				headers: {
					"Authorization": `Bearer ${this.#accessToken}`,
					"Content-Type": "application/json",
					"User-Agent": "Crosspost (https://github.com/humanwhocodes/crosspost, v0.15.1)", // x-release-please-version
				},
				body: JSON.stringify(payload),
				signal: postOptions?.signal,
			},
		);

		if (!response.ok) {
			const errorResponse = /** @type {WebflowErrorResponse} */ (
				await response.json()
			);

			throw new Error(
				`${response.status} Failed to create collection item: ${response.statusText}\n${errorResponse.message}`,
			);
		}

		return /** @type {Promise<WebflowResponse>} */ (response.json());
	}

	/**
	 * Extracts the URL from a Webflow response.
	 * @param {WebflowResponse} response The response from the Webflow API.
	 * @returns {string} The URL of the created item.
	 * @throws {Error} When the response doesn't contain the necessary data.
	 */
	getUrlFromResponse(response) {
		if (!response) {
			throw new Error("Response is required.");
		}

		if (!response.slug) {
			throw new Error("Response must contain a slug.");
		}

		// Note: This is a simplified URL construction. In a real implementation,
		// you might need to know the site's custom domain or use the Webflow-provided URL
		return `https://${this.#siteId}.webflow.io/${response.slug}`;
	}
}