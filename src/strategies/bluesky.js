/**
 * @fileoverview Bluesky strategy for posting messages.
 * @author Nicholas C. Zakas
 */

/* global fetch */

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

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
 * @typedef {Object} CreateRecordResponse
 * @property {string} cid The CID of the post.
 * @property {Object} commit The commit information.
 * @property {string} commit.cid The CID of the commit.
 * @property {string} commit.rev The revision of the commit.
 * @property {string} uri The URI of the post.
 * @property {string} validationStatus The validation status of the post.
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
 * Creates a session with Bluesky.
 * @param {BlueskyOptions} options The options for the strategy.
 * @returns {Promise<BlueskySession>} A promise that resolves with the session data.
 */
function createSession(options) {
	const url = getCreateSessionUrl(options);

	return fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			identifier: options.identifier,
			password: options.password,
		}),
	}).then(response => {
		if (response.ok) {
			return /** @type {Promise<BlueskySession>} */ (response.json());
		}

		throw new Error(
			`${response.status} Failed to create session: ${response.statusText}`,
		);
	});
}

/**
 * Posts a message to Bluesky.
 * @param {BlueskyOptions} options The options for the strategy.
 * @param {BlueskySession} session The session data.
 * @param {string} message The message to post.
 * @returns {Promise<CreateRecordResponse>} A promise that resolves with the post data.
 */
function postMessage(options, session, message) {
	const url = getPostMessageUrl(options);

	return fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${session.accessJwt}`,
		},
		body: JSON.stringify({
			repo: session.did,
			collection: "app.bsky.feed.post",
			record: {
				$type: "app.bsky.feed.post",
				text: message,
				createdAt: new Date().toISOString(),
			},
		}),
	}).then(response => {
		if (response.ok) {
			return /** @type {Promise<CreateRecordResponse>} */ (
				response.json()
			);
		}

		throw new Error(
			`${response.status} Failed to create session: ${response.statusText}`,
		);
	});
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
	 * @returns {Promise<CreateRecordResponse>} A promise that resolves with the post data.
	 */
	async post(message) {
		if (!message) {
			throw new TypeError("Missing message to post.");
		}

		const session = await createSession(this.#options);

		return postMessage(this.#options, session, message);
	}
}
