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
 */

/** @typedef {[string]|[string,string]|[string,string,string]|[string,string,string,string]} TwitterMediaIdArray */

/** @typedef {import("../types.js").PostOptions} PostOptions */

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
}
