/**
 * @fileoverview Bluesky strategy for posting messages.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { AtpAgent, RichText } from "@atproto/api";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @typedef {Object} BlueskyOptions
 * @property {string} identifier The username to post with.
 * @property {string} password The application password to use.
 * @property {string} host The host domain for the Bluesky instance.
 */

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

        const {
            identifier,
            password,
            host
        } = options;

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
     * @returns {Promise<Object>} A promise that resolves with the post data.
     */
    async post(message) {
        if (!message) {
            throw new TypeError("Missing message to post.");
        }

        const {
            identifier,
            password,
            host
        } = this.#options;

        const agent = new AtpAgent({
            service: `https://${host}`
        });

        await agent.login({
            identifier,
            password
        });

        const richText = new RichText({ text: message});
        await richText.detectFacets(agent);

        const post = {
            $type: "app.bsky.feed.post",
            text: richText.text,
            facets: richText.facets,
            createdAt: new Date().toISOString()
        };

        return agent.post(post);
    }
}
