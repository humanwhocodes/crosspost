/**
 * @fileoverview Twitter strategy for posting tweets.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { TwitterApi } from "twitter-api-v2";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @typedef {Object} TwitterOptions
 * @property {string} accessTokenKey The access token for the Twitter app.
 * @property {string} accessTokenSecret The access token secret for the Twitter app.
 * @property {string} apiConsumerKey The app (consumer) key for the Twitter app.
 * @property {string} apiConsumerSecret The app (consumer) secret for the Twitter app.
 */

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A strategy for posting to Twitter.
 */
export class TwitterStrategy {
  /**
   * The name of the strategy.
   * @type {string}
   * @readonly
   */
  name = "twitter";

  /**
   * Options for this instance.
   * @type {TwitterOptions}
   */
  #options;

  /**
   * Creates a new instance.
   * @param {TwitterOptions} options Options for the instance.
   * @throws {Error} When options are missing.
   */
  constructor(options) {
    const {
      accessTokenKey,
      accessTokenSecret,
      apiConsumerKey,
      apiConsumerSecret,
    } = options;

    if (!accessTokenKey) {
      throw new TypeError("Missing Twitter access token key.");
    }

    if (!accessTokenSecret) {
      throw new TypeError("Missing Twitter access token secret.");
    }

    if (!apiConsumerKey) {
      throw new TypeError("Missing Twitter consumer key.");
    }

    if (!apiConsumerSecret) {
      throw new TypeError("Missing Twitter consumer secret.");
    }

    this.#options = options;
  }

  /**
   * Posts a message to Twitter.
   * @param {string} message The message to tweet.
   * @returns {Promise<object>} A promise that resolves with the tweet data.
   */
  async post(message) {
    if (!message) {
      throw new Error("Missing message to tweet.");
    }

    const {
      accessTokenKey,
      accessTokenSecret,
      apiConsumerKey,
      apiConsumerSecret,
    } = this.#options;

    const client = new TwitterApi({
      appKey: apiConsumerKey,
      appSecret: apiConsumerSecret,
      accessToken: accessTokenKey,
      accessSecret: accessTokenSecret,
    });

    return client.v2.tweet(message);
  }
}
