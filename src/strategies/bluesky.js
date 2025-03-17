/**
 * @fileoverview Bluesky strategy for posting messages.
 * @author Nicholas C. Zakas
 */

/* global fetch */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { detectFacets } from "../util/bluesky-facets.js";
import { validatePostOptions } from "../util/options.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/** @typedef {import("../types.js").PostOptions} BlueskyPostOptions */

/**
 * @typedef {Object} BlueskyOptions
 * @property {string} identifier The username to post with.
 * @property {string} password The application password to use.
 * @property {string} host The host domain for the Bluesky instance.
 */

/**
 * @typedef {Object} BlueskySession
 * @property {string} accessJwt The access JWT for the session.
 * @property {string} refreshJwt The refresh JWT for the session.
 * @property {boolean} active Indicates if the session is active.
 * @property {string} did The DID of the session.
 */

/**
 * @typedef {Object} BlueskyImage
 * @property {string} alt The alt text for the image.
 * @property {Object} image The image data.
 * @property {string} image.$type The type of the image.
 * @property {Object} image.ref The reference to the image.
 * @property {string} image.ref.$link The link to the image.
 * @property {string} image.mimeType The MIME type of the image.
 * @property {number} image.size The size of the image in bytes.
 */

/**
 * @typedef {Object} BlueskyPostBody
 * @property {string} repo The DID of the user.
 * @property {string} collection The collection type (always "app.bsky.feed.post").
 * @property {Object} record The post record.
 * @property {string} record.$type The type of record (always "app.bsky.feed.post").
 * @property {string} record.text The text content of the post.
 * @property {Array<Object>} record.facets The facets/entities in the post.
 * @property {string} record.createdAt The ISO timestamp of post creation.
 * @property {Object} [record.embed] The embedded content in the post.
 * @property {string} record.embed.$type The type of embedded content.
 * @property {Array<Object>} [record.embed.images] The images to embed.
 *
 */

/**
 * @typedef {Object} CreateRecordResponse
 * @property {string} cid The CID of the post.
 * @property {Object} commit The commit information.
 * @property {string} commit.cid The CID of the commit.
 * @property {string} commit.rev The revision of the commit.
 * @property {string} uri The URI of the post.
 * @property {string} validationStatus The validation status of the post.
 */

/**
 * @typedef {Object} BlueskyErrorResponse
 * @property {string} error The type of error.
 * @property {string} message The error message.
 */

/**
 * @typedef {Object} UploadBlobResponse
 * @property {Object} blob The blob data
 * @property {"blob"} blob.$type The type of blob
 * @property {Object} blob.ref The reference to the blob
 * @property {string} blob.ref.$link The link to the blob
 * @property {string} blob.mimeType The MIME type of the blob
 * @property {number} blob.size The size of the blob in bytes
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * Gets the URL for creating a session.
 * @param {BlueskyOptions} options The options for the strategy.
 * @returns {string} The URL for creating a session.
 */
function getCreateSessionUrl(options) {
	return `https://${options.host}/xrpc/com.atproto.server.createSession`;
}

/**
 * Gets the URL for posting a message.
 * @param {BlueskyOptions} options The options for the strategy.
 * @returns {string} The URL for posting a message.
 */
function getPostMessageUrl(options) {
	return `https://${options.host}/xrpc/com.atproto.repo.createRecord`;
}

/**
 * Gets the URL for uploading a blob.
 * @param {BlueskyOptions} options The options for the strategy.
 * @returns {string} The URL for uploading a blob.
 */
function getUploadBlobUrl(options) {
	return `https://${options.host}/xrpc/com.atproto.repo.uploadBlob`;
}

/**
 * Uploads an image to Bluesky.
 * @param {BlueskyOptions} options The options for the strategy.
 * @param {BlueskySession} session The session data.
 * @param {Uint8Array} imageData The image data to upload.
 * @returns {Promise<UploadBlobResponse>} A promise that resolves with the blob data.
 */
async function uploadImage(options, session, imageData) {
	const url = getUploadBlobUrl(options);

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "*/*",
			Authorization: `Bearer ${session.accessJwt}`,
		},
		body: imageData,
	});

	if (response.ok) {
		return /** @type {Promise<UploadBlobResponse>} */ (response.json());
	}

	const errorBody = /** @type {BlueskyErrorResponse} */ (
		await response.json()
	);

	throw new Error(
		`${response.status} ${response.statusText}: Failed to upload image:\n${errorBody.error} - ${errorBody.message}`,
	);
}

/**
 * Creates a session with Bluesky.
 * @param {BlueskyOptions} options The options for the strategy.
 * @returns {Promise<BlueskySession>} A promise that resolves with the session data.
 */
async function createSession(options) {
	const url = getCreateSessionUrl(options);

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			identifier: options.identifier,
			password: options.password,
		}),
	});

	if (response.ok) {
		return /** @type {Promise<BlueskySession>} */ (response.json());
	}

	const errorBody = /** @type {BlueskyErrorResponse} */ (
		await response.json()
	);

	throw new Error(
		`${response.status} ${response.statusText}: Failed to create session:\n${errorBody.error} - ${errorBody.message}`,
	);
}

/**
 * Posts a message to Bluesky.
 * @param {BlueskyOptions} options The options for the strategy.
 * @param {BlueskySession} session The session data.
 * @param {string} message The message to post.
 * @param {BlueskyPostOptions} [postOptions] Additional options for the post.
 * @returns {Promise<CreateRecordResponse>} A promise that resolves with the post data.
 */
async function postMessage(options, session, message, postOptions) {
	const url = getPostMessageUrl(options);
	const facets = detectFacets(message);

	/** @type {BlueskyPostBody} */
	const body = {
		repo: session.did,
		collection: "app.bsky.feed.post",
		record: {
			$type: "app.bsky.feed.post",
			text: message,
			facets,
			createdAt: new Date().toISOString(),
		},
	};

	// add image embeds if present
	if (postOptions?.images?.length) {
		const images = [];

		for (const image of postOptions.images) {
			const result = await uploadImage(options, session, image.data);

			images.push({
				alt: image.alt || "",
				image: result.blob,
			});
		}

		if (images.length) {
			body.record.embed = {
				$type: "app.bsky.embed.images",
				images,
			};
		}
	}

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${session.accessJwt}`,
		},
		body: JSON.stringify(body),
	});

	if (response.ok) {
		return /** @type {Promise<CreateRecordResponse>} */ (response.json());
	}

	const errorBody = /** @type {BlueskyErrorResponse} */ (
		await response.json()
	);

	throw new Error(
		`${response.status} ${response.statusText}: Failed to post message:\n${errorBody.error} - ${errorBody.message}`,
	);
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A strategy for posting messages to Bluesky.
 */
export class BlueskyStrategy {
	/**
	 * The name of the strategy.
	 * @type {string}
	 * @readonly
	 */
	name = "bluesky";

	/**
	 * Options for this instance.
	 * @type {BlueskyOptions}
	 */
	#options;

	/**
	 * Creates a new instance.
	 * @param {BlueskyOptions} options Options for the instance.
	 * @throws {Error} When options are missing.
	 */
	constructor(options) {
		const { identifier, password, host } = options;

		if (!identifier) {
			throw new TypeError("Missing identifier.");
		}

		if (!password) {
			throw new TypeError("Missing password.");
		}

		if (!host) {
			throw new TypeError("Missing host.");
		}

		this.#options = options;
	}

	/**
	 * Posts a message to Bluesky.
	 * @param {string} message The message to post.
	 * @param {BlueskyPostOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<CreateRecordResponse>} A promise that resolves with the post data.
	 */
	async post(message, postOptions) {
		if (!message) {
			throw new TypeError("Missing message to post.");
		}

		validatePostOptions(postOptions);

		const session = await createSession(this.#options);
		return postMessage(this.#options, session, message, postOptions);
	}
}
