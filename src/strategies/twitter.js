/**
 * @fileoverview Twitter strategy for posting tweets.
 * @author Nicholas C. Zakas
 */
/* global Buffer */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { TwitterApi } from "twitter-api-v2";
import { validatePostOptions } from "../util/options.js";
import { getImageMimeType } from "../util/images.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @typedef {Object} TwitterOptions
 * @property {string} accessTokenKey The access token for the Twitter app.
 * @property {string} accessTokenSecret The access token secret for the Twitter app.
 * @property {string} apiConsumerKey The app (consumer) key for the Twitter app.
 * @property {string} apiConsumerSecret The app (consumer) secret for the Twitter app.
 *
 * @typedef {Object} TwitterPostResponse
 * @property {Object} data The data of the posted tweet.
 * @property {string} data.id The ID of the tweet.
 * @property {string} data.text The text content of the tweet.
 * @property {string[]} data.edit_history_tweet_ids The edit history tweet IDs.
 */

/** @typedef {[string]|[string,string]|[string,string,string]|[string,string,string,string]} TwitterMediaIdArray */

/** @typedef {import("../types.js").PostOptions} PostOptions */
/** @typedef {import("../types.js").PostThreadEntry} PostThreadEntry */
/** @typedef {import("../types.js").PostThreadOptions} PostThreadOptions */

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A strategy for posting to Twitter.
 */
export class TwitterStrategy {
	/**
	 * The ID of the strategy.
	 * @type {string}
	 * @readonly
	 */
	id = "twitter";

	/**
	 * The display name of the strategy.
	 * @type {string}
	 * @readonly
	 */
	name = "X (formerly Twitter)";

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
	 * @param {PostOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<object>} A promise that resolves with the tweet data.
	 */
	async post(message, postOptions) {
		if (!message) {
			throw new TypeError("Missing message to tweet.");
		}

		validatePostOptions(postOptions);

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

		postOptions?.signal?.throwIfAborted();

		// if there are images, upload them first
		if (postOptions?.images?.length) {
			const mediaIds = await Promise.all(
				postOptions.images.map(image =>
					client.v2
						.uploadMedia(Buffer.from(image.data), {
							media_type: getImageMimeType(image.data),
						})
						.then(mediaId => {
							if (image.alt) {
								// https://docs.x.com/x-api/media/metadata-create
								return client.v2
									.post("media/metadata", {
										id: mediaId,
										metadata: {
											alt_text: {
												text: image.alt,
											},
										},
									})
									.then(() => mediaId);
							}

							return mediaId;
						}),
				),
			);

			postOptions?.signal?.throwIfAborted();

			return client.v2.tweet(message, {
				media: {
					media_ids: /** @type {TwitterMediaIdArray} */ (mediaIds),
				},
			});
		}

		return client.v2.tweet(message);
	}

	/**
	 * Extracts a URL from a Twitter API response.
	 * @param {TwitterPostResponse} response The response from the Twitter API post request.
	 * @returns {string} The URL for the tweet.
	 */
	getUrlFromResponse(response) {
		if (!response?.data?.id) {
			throw new Error("Tweet ID not found in response");
		}

		// This format works without knowing the username - Twitter will redirect appropriately
		return `https://x.com/i/web/status/${response.data.id}`;
	}

	/**
	 * Posts a thread of messages to Twitter.
	 * @param {Array<PostThreadEntry>} entries An array of messages to post as a thread.
	 * @param {PostThreadOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<Array<object>>} A promise that resolves with an array of tweet data for each message in the thread.
	 */
	async postThread(entries, postOptions) {
		if (!entries || entries.length === 0) {
			throw new TypeError("Expected at least one entry.");
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

		const responses = [];
		let previousTweetId;

		for (const entry of entries) {
			if (!entry.message) {
				throw new TypeError("Missing message in thread entry.");
			}

			postOptions?.signal?.throwIfAborted();

			// Upload images if present
			let mediaIds;
			if (entry.images?.length) {
				mediaIds = await Promise.all(
					entry.images.map(image =>
						client.v2
							.uploadMedia(Buffer.from(image.data), {
								media_type: getImageMimeType(image.data),
							})
							.then(mediaId => {
								if (image.alt) {
									return client.v2
										.post("media/metadata", {
											id: mediaId,
											metadata: {
												alt_text: {
													text: image.alt,
												},
											},
										})
										.then(() => mediaId);
								}

								return mediaId;
							}),
					),
				);

				postOptions?.signal?.throwIfAborted();
			}

			// Build tweet options
			const tweetOptions = {};
			if (previousTweetId) {
				tweetOptions.reply = {
					in_reply_to_tweet_id: previousTweetId,
				};
			}

			if (mediaIds) {
				tweetOptions.media = {
					media_ids: /** @type {TwitterMediaIdArray} */ (mediaIds),
				};
			}

			const response = await client.v2.tweet(
				entry.message,
				Object.keys(tweetOptions).length > 0 ? tweetOptions : undefined,
			);

			responses.push(response);
			previousTweetId = response.data.id;
		}

		return responses;
	}

	/**
	 * Maximum length of a tweet in characters.
	 * @type {number}
	 * @const
	 */
	MAX_MESSAGE_LENGTH = 280;

	/**
	 * Calculates the length of a message according to Twitter's algorithm.
	 * URLs are counted as 23 characters for http:// or https:// URLs regardless of their actual length.
	 * @param {string} message The message to calculate the length of.
	 * @returns {number} The calculated length of the message.
	 */
	calculateMessageLength(message) {
		// Replace URLs with 23 characters (Twitter's t.co length)
		const urlAdjusted = message.replace(
			/https?:\/\/[^\s]+/g,
			"x".repeat(23),
		);
		return [...urlAdjusted].length;
	}
}
