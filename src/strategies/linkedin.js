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

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const POST_URL = "https://api.linkedin.com/v2/ugcPosts";
const USER_INFO_URL = "https://api.linkedin.com/v2/userinfo";

/**
 * Retrieves the person URN from LinkedIn.
 * @param {string} accessToken The access token for the LinkedIn API.
 * @returns {Promise<string>} A promise that resolves with the person URN.
 * @throws {Error} When the request fails.
 */
async function fetchPersonUrn(accessToken) {
	const response = await fetch(USER_INFO_URL, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
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
 * Creates a post on LinkedIn.
 * @param {LinkedInOptions} options The options for the strategy.
 * @param {string} message The message to post.
 * @returns {Promise<LinkedInPostResponse>} A promise that resolves with the post data.
 */
async function createPost(options, message) {
	const author = await fetchPersonUrn(options.accessToken);

	const response = await fetch(POST_URL, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${options.accessToken}`,
			"Content-Type": "application/json",
			"X-Restli-Protocol-Version": "2.0.0",
		},
		body: JSON.stringify({
			author,
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
		}),
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
	 * The name of the strategy.
	 * @type {string}
	 * @readonly
	 */
	name = "linkedin";

	/**
	 * Options for this instance.
	 * @type {LinkedInOptions}
	 */
	#options;

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
	 * Posts a message to LinkedIn.
	 * @param {string} message The message to post.
	 * @returns {Promise<LinkedInPostResponse>} A promise that resolves with the post data.
	 * @throws {TypeError} If message is missing.
	 */
	async post(message) {
		if (!message) {
			throw new TypeError("Missing message to post.");
		}

		return createPost(this.#options, message);
	}
}
