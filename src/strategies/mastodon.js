/**
 * @fileoverview Mastodon strategy for posting toots.
 * @author Nicholas C. Zakas
 */

/* global fetch, FormData */

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @typedef {Object} MastodonOptions
 * @property {string} accessToken The access token for the Mastodon account.
 * @property {string} host The host for the Mastodon instance.
 */

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A strategy for posting toots to Mastodon.
 */
export class MastodonStrategy {

    /**
     * The name of the strategy.
     * @type {string}
     * @readonly
     */
    name = "mastodon";

    /**
     * Options for this instance.
     * @type {MastodonOptions}
     */
    #options;

    /**
     * Creates a new instance.
     * @param {MastodonOptions} options Options for the instance.
     * @throws {Error} When options are missing.
     */
    constructor(options) {

        const {
            accessToken,
            host
        } = options;

        if (!accessToken) {
            throw new TypeError("Missing Mastodon access token.");
        }

        if (!host) {
            throw new TypeError("Missing Mastodon host.");
        }

        this.#options = options;
    }

    /**
     * Posts a message to Mastodon.
     * @param {string} message The message to post.
     * @returns {Promise<Object>} A promise that resolves with the post data.
     */
    async post(message) {
        if (!message) {
            throw new Error("Missing message to toot.");
        }

        const {
            accessToken,
            host
        } = this.#options;

        const url = `https://${host}/api/v1/statuses`;
        const data = new FormData();
        data.append("status", message);

        return /**@type {Object} */ (fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`
            },
            body: data
        }).then(response => response.json()));
    }
}
