/**
 * @fileoverview Facebook strategy for posting messages.
 * @author Nicholas C. Zakas
 */

/* global fetch */

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @typedef {Object} FacebookOptions
 * @property {string} accessToken The access token for the Facebook API.
 * @property {string} [pageId] The ID of the Facebook page to post to (optional).
 */

/**
 * @typedef {Object} FacebookPostResponse
 * @property {string} id The ID of the created post.
 */

/**
 * @typedef {Object} FacebookMeResponse
 * @property {string} id The ID of the user.
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const BASE_URL = "https://graph.facebook.com/v22.0";

/**
 * Gets the endpoint URL for posting.
 * @param {FacebookOptions} options The Facebook options.
 * @returns {string} The URL to post to.
 */
function getPostUrl(options) {
    return `${BASE_URL}/${options.pageId || "me"}/feed`;
}

/**
 * Fetches the user ID from the Facebook API.
 * @param {string} accessToken The access token.
 * @returns {Promise<string>} The user ID.
 * @throws {Error} When the request fails.
 */
async function fetchUserId(accessToken) {
    const response = await fetch(`${BASE_URL}/me?fields=id,access_token=${accessToken}`);
    
    if (!response.ok) {
        throw new Error(`Failed to fetch user ID: ${response.statusText}`);
    }
    
    const data = /** @type {FacebookMeResponse} */ (await response.json());
    return String(data.id);
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A strategy for posting messages to Facebook.
 */
export class FacebookStrategy {

    /**
     * The name of the strategy.
     * @type {string}
     * @readonly
     */
    name = "facebook";

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
     * @returns {Promise<FacebookPostResponse>} A promise that resolves with the post data.
     * @throws {TypeError} If message is missing.
     */
    async post(message) {
        if (!message) {
            throw new TypeError("Missing message to post.");
        }

        const response = await fetch(getPostUrl(this.#options), {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message,
                access_token: this.#options.accessToken
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(
                `${response.status} Failed to create post: ${response.statusText}\n${error.error?.message || "Unknown error"}`
            );
        }

        return response.json();
    }
}
