/**
 * @fileoverview Bluesky strategy for posting messages.
 * @author Nicholas C. Zakas
 */

/* global fetch, URLSearchParams */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { detectFacets } from "../util/bluesky-facets.js";
import { imageSize } from "image-size";
import { validatePostOptions } from "../util/options.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/** @typedef {import("../types.js").PostOptions} PostOptions */
/** @typedef {import("../types.js").PostThreadEntry} PostThreadEntry */
/** @typedef {import("../types.js").PostThreadOptions} PostThreadOptions */

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
 * @property {Object} [record.reply] Reply information for threading.
 * @property {Object} record.reply.root The root post of the thread.
 * @property {string} record.reply.root.uri The URI of the root post.
 * @property {string} record.reply.root.cid The CID of the root post.
 * @property {Object} record.reply.parent The parent post in the thread.
 * @property {string} record.reply.parent.uri The URI of the parent post.
 * @property {string} record.reply.parent.cid The CID of the parent post.
 *
 */

/**
 * @typedef {Object} BlueskyCreateRecordResponse
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
 * @typedef {Object} BlueskyUploadBlobResponse
 * @property {Object} blob The blob data
 * @property {"blob"} blob.$type The type of blob
 * @property {Object} blob.ref The reference to the blob
 * @property {string} blob.ref.$link The link to the blob
 * @property {string} blob.mimeType The MIME type of the blob
 * @property {number} blob.size The size of the blob in bytes
 */

/**
 * @typedef {Object} BlueskyResolveHandleResponse
 * @property {string} did The DID corresponding to the handle.
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
 * Gets the URL for resolving a handle to a DID.
 * @param {BlueskyOptions} options The options for the strategy.
 * @returns {string} The URL for resolving a handle.
 */
function getResolveHandleUrl(options) {
	return `https://${options.host}/xrpc/com.atproto.identity.resolveHandle`;
}

/**
 * Resolves a handle to its corresponding DID.
 * @param {BlueskyOptions} options The options for the strategy.
 * @param {string} handle The handle to resolve (without @ prefix).
 * @param {AbortSignal} [signal] The abort signal for the request.
 * @returns {Promise<string>} A promise that resolves with the DID.
 */
async function resolveHandle(options, handle, signal) {
	const url = getResolveHandleUrl(options);
	const params = new URLSearchParams({ handle });

	const response = await fetch(`${url}?${params}`, {
		method: "GET",
		signal,
	});

	if (response.ok) {
		const result = /** @type {Promise<BlueskyResolveHandleResponse>} */ (
			response.json()
		);
		return (await result).did;
	}

	const errorBody = /** @type {BlueskyErrorResponse} */ (
		await response.json()
	);

	throw new Error(
		`${response.status} ${response.statusText}: Failed to resolve handle "${handle}":\n${errorBody.error} - ${errorBody.message}`,
	);
}

/**
 * Uploads an image to Bluesky.
 * @param {BlueskyOptions} options The options for the strategy.
 * @param {BlueskySession} session The session data.
 * @param {Uint8Array} imageData The image data to upload.
 * @param {AbortSignal} [signal] The abort signal for the request.
 * @returns {Promise<BlueskyUploadBlobResponse>} A promise that resolves with the blob data.
 */
async function uploadImage(options, session, imageData, signal) {
	const url = getUploadBlobUrl(options);

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "*/*",
			Authorization: `Bearer ${session.accessJwt}`,
		},
		body: imageData,
		signal,
	});

	if (response.ok) {
		return /** @type {Promise<BlueskyUploadBlobResponse>} */ (
			response.json()
		);
	}

	const errorBody = /** @type {BlueskyErrorResponse} */ (
		await response.json()
	);

	throw new Error(
		`${response.status} ${response.statusText}: Failed to upload image:\n${errorBody.error} - ${errorBody.message}`,
	);
}

/**
 * Resolves mention handles to DIDs in facets.
 * @param {BlueskyOptions} options The options for the strategy.
 * @param {Array<{index: Object, features: Array<{$type: string, did?: string, uri?: string, tag?: string}>}>} facets The facets to process.
 * @param {AbortSignal} [signal] The abort signal for the request.
 * @returns {Promise<Array<{index: Object, features: Array<{$type: string, did?: string, uri?: string, tag?: string}>}>>} A promise that resolves with processed facets.
 */
async function resolveMentionFacets(options, facets, signal) {
	const processedFacets = [];

	for (const facet of facets) {
		const processedFeatures = [];

		for (const feature of facet.features) {
			// Check if this is a mention facet
			if (
				feature.$type === "app.bsky.richtext.facet#mention" &&
				feature.did
			) {
				try {
					// Resolve the handle to a DID
					const did = await resolveHandle(
						options,
						feature.did,
						signal,
					);
					processedFeatures.push({
						...feature,
						did,
					});
				} catch {
					// If handle resolution fails, skip this mention facet
					// to prevent the entire post from failing
					continue;
				}
			} else {
				// For non-mention facets, keep them as-is
				processedFeatures.push(feature);
			}
		}

		// Only add the facet if it has features after processing
		if (processedFeatures.length > 0) {
			processedFacets.push({
				...facet,
				features: processedFeatures,
			});
		}
	}

	return processedFacets;
}

/**
 * Creates a session with Bluesky.
 * @param {BlueskyOptions} options The options for the strategy.
 * @param {AbortSignal} [signal] The abort signal for the request.
 * @returns {Promise<BlueskySession>} A promise that resolves with the session data.
 */
async function createSession(options, signal) {
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
		signal,
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
 * @param {PostOptions} [postOptions] Additional options for the post.
 * @param {Object} [replyInfo] Reply information for threading.
 * @param {Object} replyInfo.root The root post of the thread.
 * @param {string} replyInfo.root.uri The URI of the root post.
 * @param {string} replyInfo.root.cid The CID of the root post.
 * @param {Object} replyInfo.parent The parent post in the thread.
 * @param {string} replyInfo.parent.uri The URI of the parent post.
 * @param {string} replyInfo.parent.cid The CID of the parent post.
 * @returns {Promise<BlueskyCreateRecordResponse>} A promise that resolves with the post data.
 */
async function postMessage(options, session, message, postOptions, replyInfo) {
	const url = getPostMessageUrl(options);

	// Detect facets from the truncated message; detectFacets now returns { facets, text }
	const { facets: rawFacets, text: truncatedMessage } = detectFacets(message);

	// Resolve mention handles to DIDs in facets
	const facets = await resolveMentionFacets(
		options,
		rawFacets,
		postOptions?.signal,
	);

	/** @type {BlueskyPostBody} */
	const body = {
		repo: session.did,
		collection: "app.bsky.feed.post",
		record: {
			$type: "app.bsky.feed.post",
			text: truncatedMessage,
			facets,
			createdAt: new Date().toISOString(),
		},
	};

	// Add reply information if provided
	if (replyInfo) {
		body.record.reply = replyInfo;
	}

	// add image embeds if present
	if (postOptions?.images?.length) {
		const images = [];

		for (const image of postOptions.images) {
			const result = await uploadImage(
				options,
				session,
				image.data,
				postOptions?.signal,
			);

			const { width, height } = imageSize(image.data);

			images.push({
				alt: image.alt || "",
				image: result.blob,
				aspectRatio: { width, height },
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
		signal: postOptions?.signal,
	});

	if (response.ok) {
		return /** @type {Promise<BlueskyCreateRecordResponse>} */ (
			response.json()
		);
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
	 * Maximum length of a Bluesky post in characters.
	 * @type {number}
	 * @const
	 */
	MAX_MESSAGE_LENGTH = 300;

	/**
	 * The ID of the strategy.
	 * @type {string}
	 * @readonly
	 */
	id = "bluesky";

	/**
	 * The display name of the strategy.
	 * @type {string}
	 * @readonly
	 */
	name = "Bluesky";

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
	 * Calculates the length of a message according to Bluesky's algorithm.
	 * URLs longer than 27 characters are counted as 27 characters (representing truncated length),
	 * all other Unicode characters are counted as is.
	 * @param {string} message The message to calculate the length of.
	 * @returns {number} The calculated length of the message.
	 */
	calculateMessageLength(message) {
		// Replace URLs with their truncated length (27 chars if longer, original if shorter)
		const urlAdjusted = message.replace(/https?:\/\/[^\s]+/g, url => {
			return url.length > 27 ? "x".repeat(27) : url;
		});
		return [...urlAdjusted].length;
	}

	/**
	 * Posts a message to Bluesky.
	 * @param {string} message The message to post.
	 * @param {PostOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<BlueskyCreateRecordResponse>} A promise that resolves with the post data.
	 */
	async post(message, postOptions) {
		if (!message) {
			throw new TypeError("Missing message to post.");
		}

		validatePostOptions(postOptions);

		const session = await createSession(this.#options, postOptions?.signal);
		return postMessage(this.#options, session, message, postOptions);
	}

	/**
	 * Extracts a URL from a Bluesky API response.
	 * @param {BlueskyCreateRecordResponse} response The response from the Bluesky post request.
	 * @returns {string} The URL for the Bluesky post.
	 */
	getUrlFromResponse(response) {
		if (!response?.uri) {
			throw new Error("Post URI not found in response");
		}

		// The URI format is typically: at://did:plc:something/app.bsky.feed.post/recordId
		const parts = response.uri.split("/");
		const recordId = parts[parts.length - 1];

		/*
		 * Cheating for now: No way to map the API host to the web host, so just
		 * assume the web host is always bsky.app.
		 */
		return `https://bsky.app/profile/${this.#options.identifier}/post/${recordId}`;
	}

	/**
	 * Posts a thread of messages to Bluesky.
	 * @param {Array<PostThreadEntry>} entries An array of messages to post as a thread.
	 * @param {PostThreadOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<Array<BlueskyCreateRecordResponse>>} A promise that resolves with an array of post data for each message in the thread.
	 */
	async postThread(entries, postOptions) {
		if (!entries || entries.length === 0) {
			throw new TypeError("Expected at least one entry.");
		}

		const session = await createSession(this.#options, postOptions?.signal);
		const responses = [];
		let previousPost;

		for (const entry of entries) {
			if (!entry.message) {
				throw new TypeError("Missing message in thread entry.");
			}

			postOptions?.signal?.throwIfAborted();

			// Build reply information for subsequent posts in the thread
			const replyInfo = previousPost
				? {
						root: {
							uri: responses[0].uri,
							cid: responses[0].cid,
						},
						parent: {
							uri: previousPost.uri,
							cid: previousPost.cid,
						},
					}
				: undefined;

			const postResponse = await postMessage(
				this.#options,
				session,
				entry.message,
				{
					images: entry.images,
					signal: postOptions?.signal,
				},
				replyInfo,
			);

			responses.push(postResponse);
			previousPost = postResponse;
		}

		return responses;
	}
}
