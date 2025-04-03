/**
 * @fileoverview LinkedIn strategy for posting messages.
 * @author Nicholas C. Zakas
 */

/* global fetch */

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @typedef {Object} LinkedInOptions
 * @property {string} accessToken The access token for the LinkedIn API.
 */

/**
 * @typedef {Object} LinkedInPostResponse
 * @property {string} id The URN of the newly created post.
 */

/**
 * @typedef {Object} LinkedInUserInfoResponse
 * @property {string} name The name of the user.
 * @property {string} sub The subject identifier for the user.
 * @property {Object} locale The locale information of the user.
 * @property {string} locale.country The country code of the user's locale.
 * @property {string} locale.language The language code of the user's locale.
 * @property {string} given_name The given name of the user.
 * @property {string} family_name The family name of the user.
 * @property {string} picture The URL of the user's profile picture.
 */

/*
{"errorDetailType":"com.linkedin.common.
error.BadRequest","message":"com.linkedi
n.content.common.exception.BadRequestRes
ponseException: Content is a duplicate o
f urn:li:share:7295588489876647936","err
orDetails":{"inputErrors":[{"description
":"Duplicate post is detected","input":{
},"code":"DUPLICATE_POST"}]},"status":42
2}
*/

/**
 * @typedef {Object} LinkedInMedia
 * @property {string} media - The URN of the media asset
 * @property {string} status - The status of the media (e.g., "READY")
 * @property {Object} title - The title of the media
 * @property {Array<Object>} [title.attributes] - Attributes for the title
 * @property {string} title.text - The text of the media title
 */

/**
 * @typedef {Object} LinkedInShareContent
 * @property {LinkedInMedia[]} [media] - Array of media attachments
 * @property {Object} shareCommentary - The main text content of the post
 * @property {Array<Object>} [shareCommentary.attributes] - Attributes for the text
 * @property {string} shareCommentary.text - The text content
 * @property {string} shareMediaCategory - The type of media being shared (e.g., "VIDEO", "IMAGE", "NONE")
 */

/**
 * @typedef {Object} LinkedInPostBody
 * @property {string} author - The URN identifier of the post author (person or organization)
 * @property {string} lifecycleState - The state of the post (e.g., "PUBLISHED")
 * @property {Record<"com.linkedin.ugc.ShareContent",LinkedInShareContent>} specificContent - The content-specific details of the post
 * @property {Record<string,string>} visibility - Visibility settings for the post
 */

/**
 * @typedef {Object} LinkedInErrorResponse
 * @property {string} errorDetailType The type of error detail.
 * @property {string} message The error message.
 * @property {Object} errorDetails The details of the error.
 * @property {Array<Object>} errorDetails.inputErrors The input errors.
 * @property {string} errorDetails.inputErrors[].description The description of the input error.
 * @property {Object} errorDetails.inputErrors[].input The input object.
 * @property {string} errorDetails.inputErrors[].code The error code.
 * @property {number} status The HTTP status code.
 */

/**
 * @typedef {Object} LinkedInServiceRelationship
 * @property {string} identifier The service identifier URN
 * @property {string} relationshipType The type of relationship (e.g. "OWNER")
 */

/**
 * @typedef {Object} LinkedInRequestUploadRequestBody
 * @property {string} owner The URN identifier of the owner (organization or person)
 * @property {string[]} recipes Array of recipe URNs for the upload (e.g. "urn:li:digitalmediaRecipe:feedshare-image")
 * @property {LinkedInServiceRelationship[]} serviceRelationships Array of service relationship objects
 * @property {string[]} supportedUploadMechanism Array of supported upload mechanisms (e.g. "SYNCHRONOUS_UPLOAD")
 */

/**
 * @typedef {Object} LinkedInUploadMechanism
 * @property {string} uploadUrl The URL to upload the media to.
 * @property {Record<string,string>} headers The headers for the upload request.
 */

/**
 * @typedef {Object} LinkedInRequestUploadResponse
 * @property {Object} value The response value object
 * @property {string} value.mediaArtifact The URN of the media artifact
 * @property {Record<string, LinkedInUploadMechanism>} value.uploadMechanism The upload mechanism details
 * @property {string} value.asset The URN of the digital media asset
 * @property {string} value.assetRealTimeTopic The real-time topic URN for asset updates
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const POST_URL = "https://api.linkedin.com/v2/ugcPosts";
const USER_INFO_URL = "https://api.linkedin.com/v2/userinfo";

/**
 * Retrieves the person URN from LinkedIn.
 * @param {string} accessToken The access token for the LinkedIn API.
 * @param {AbortSignal} [signal] The abort signal for the request.
 * @returns {Promise<string>} A promise that resolves with the person URN.
 * @throws {Error} When the request fails.
 */
async function fetchPersonUrn(accessToken, signal) {
	const response = await fetch(USER_INFO_URL, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
		signal,
	});

	if (!response.ok) {
		throw new Error(
			`${response.status} Failed to retrieve person URN: ${response.statusText}`,
		);
	}

	const data = /** @type {LinkedInUserInfoResponse} */ (
		await response.json()
	);

	return `urn:li:person:${data.sub}`;
}

/**
 * Uploads an image to LinkedIn.
 * @param {string} accessToken The access token for the LinkedIn API.
 * @param {string} personUrn The person URN to use for the upload.
 * @param {Uint8Array} imageData The image data to upload.
 * @param {AbortSignal} [signal] The abort signal for the request.
 * @returns {Promise<string>} A promise that resolves with the asset URN.
 * @throws {Error} When the request fails.
 */
async function uploadImage(accessToken, personUrn, imageData, signal) {
	const response = await fetch(
		"https://api.linkedin.com/v2/assets?action=registerUpload",
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				registerUploadRequest: {
					recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
					owner: personUrn,
					serviceRelationships: [
						{
							relationshipType: "OWNER",
							identifier: "urn:li:userGeneratedContent",
						},
					],
				},
				signal,
			}),
		},
	);

	if (!response.ok) {
		throw new Error(
			`${response.status} Failed to register image upload: ${response.statusText}`,
		);
	}

	const {
		value: { asset, uploadMechanism },
	} = /** @type {LinkedInRequestUploadResponse} */ (await response.json());

	const uploadResponse = await fetch(
		uploadMechanism[
			"com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
		].uploadUrl,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "image/*",
			},
			body: imageData,
			signal,
		},
	);

	if (!uploadResponse.ok) {
		throw new Error(
			`${uploadResponse.status} Failed to upload image: ${uploadResponse.statusText}`,
		);
	}

	return asset;
}

/**
 * Creates a post on LinkedIn.
 * @param {LinkedInOptions} options The options for the strategy.
 * @param {string} personUrn The person URN to use for the post.
 * @param {string} message The message to post.
 * @param {import("../types.js").PostOptions} [postOptions] Additional options for the post.
 * @returns {Promise<LinkedInPostResponse>} A promise that resolves with the post data.
 */
async function createPost(options, personUrn, message, postOptions) {
	/** @type {LinkedInPostBody} */
	const body = {
		author: personUrn,
		lifecycleState: "PUBLISHED",
		specificContent: {
			"com.linkedin.ugc.ShareContent": {
				shareCommentary: {
					text: message,
				},
				shareMediaCategory: "NONE",
			},
		},
		visibility: {
			"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
		},
	};

	// handle image uploads if present
	if (postOptions?.images?.length) {
		const mediaAssets = await Promise.all(
			postOptions.images.map(image =>
				uploadImage(
					options.accessToken,
					personUrn,
					image.data,
					postOptions?.signal,
				),
			),
		);

		body.specificContent[
			"com.linkedin.ugc.ShareContent"
		].shareMediaCategory = "IMAGE";
		body.specificContent["com.linkedin.ugc.ShareContent"].media =
			mediaAssets.map((asset, index) => ({
				status: "READY",
				description: {
					text: postOptions.images[index].alt || "",
				},
				media: asset,
				title: {
					text: "",
				},
			}));
	}

	const response = await fetch(POST_URL, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${options.accessToken}`,
			"Content-Type": "application/json",
			"X-Restli-Protocol-Version": "2.0.0",
		},
		body: JSON.stringify(body),
		signal: postOptions?.signal,
	});

	if (!response.ok) {
		const errorResponse = /** @type {LinkedInErrorResponse} */ (
			await response.json()
		);

		throw new Error(
			`${response.status} Failed to create post: ${response.statusText}\n${errorResponse.message}`,
		);
	}

	return /** @type {Promise<LinkedInPostResponse>} */ (response.json());
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A strategy for posting messages to LinkedIn.
 */
export class LinkedInStrategy {
	/**
	 * The ID of the strategy.
	 * @type {string}
	 * @readonly
	 */
	id = "linkedin";

	/**
	 * The display name of the strategy.
	 * @type {string}
	 * @readonly
	 */
	name = "LinkedIn";

	/**
	 * Options for this instance.
	 * @type {LinkedInOptions}
	 */
	#options;

	/**
	 * Cached person URN.
	 * @type {Promise<string>|null}
	 */
	#personUrn = null;

	/**
	 * Creates a new instance.
	 * @param {LinkedInOptions} options Options for the instance.
	 * @throws {Error} When required options are missing.
	 */
	constructor(options) {
		const { accessToken } = options;

		if (!accessToken) {
			throw new TypeError("Missing access token.");
		}

		this.#options = options;
	}

	/**
	 * Gets the person URN, fetching it if not already cached.
	 * @returns {Promise<string>} A promise that resolves with the person URN.
	 */
	async #getPersonUrn() {
		if (!this.#personUrn) {
			this.#personUrn = fetchPersonUrn(this.#options.accessToken);
		}
		return this.#personUrn;
	}

	/**
	 * Posts a message to LinkedIn.
	 * @param {string} message The message to post.
	 * @param {import("../types.js").PostOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<LinkedInPostResponse>} A promise that resolves with the post data.
	 * @throws {TypeError} If message is missing.
	 */
	async post(message, postOptions) {
		if (!message) {
			throw new TypeError("Missing message to post.");
		}

		const personUrn = await this.#getPersonUrn();
		return createPost(this.#options, personUrn, message, postOptions);
	}
}
