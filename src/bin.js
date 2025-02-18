/**
 * @fileoverview A CLI for tooting out updates.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import * as dotenv from "dotenv";
import { parseArgs } from "node:util";
import { Env } from "@humanwhocodes/env";
import {
	Client,
	TwitterStrategy,
	MastodonStrategy,
	BlueskyStrategy,
	LinkedInStrategy,
	DiscordStrategy,
} from "./index.js";
import fs from "node:fs";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/** @typedef {import("./client.js").SuccessResponse} SuccessResponse */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * Determines if a response is successful.
 * @param {any} response The response to check.
 * @returns {response is SuccessResponse} True if the response is successful, false if not.
 */
function isSuccessResponse(response) {
	return response.ok;
}

//-----------------------------------------------------------------------------
// Parse CLI Arguments
//-----------------------------------------------------------------------------

// appease TypeScript
const booleanType = /** @type {const} */ ("boolean");
const stringType = /** @type {const} */ ("string");

const options = {
	twitter: { type: booleanType, short: "t" },
	mastodon: { type: booleanType, short: "m" },
	bluesky: { type: booleanType, short: "b" },
	linkedin: { type: booleanType, short: "l" },
	discord: { type: booleanType, short: "d" },
	file: { type: stringType },
	help: { type: booleanType, short: "h" },
};

const { values: flags, positionals } = parseArgs({
	options,
	allowPositionals: true,
});

if (
	flags.help ||
	(positionals.length === 0 && !flags.file) ||
	(!flags.twitter &&
		!flags.mastodon &&
		!flags.bluesky &&
		!flags.linkedin &&
		!flags.discord)
) {
	console.log('Usage: crosspost [options] ["Message to post."]');
	console.log("--twitter, -t	Post to Twitter.");
	console.log("--mastodon, -m	Post to Mastodon.");
	console.log("--bluesky, -b	Post to Bluesky.");
	console.log("--linkedin, -l	Post to LinkedIn.");
	console.log("--discord, -d	Post to Discord.");
	console.log("--file		The file to read the message from.");
	console.log("--help, -h	Show this message.");
	process.exit(1);
}

/*
 * Command line arguments will escape \n as \\n, which isn't what we want.
 * Remove the extra escapes so newlines can be entered on the command line.
 */
const message = flags.file
	? fs.readFileSync(flags.file, "utf8")
	: positionals[0].replace(/\\n/g, "\n");

//-----------------------------------------------------------------------------
// Load environment variables
//-----------------------------------------------------------------------------

// load environment variables from .env file if present
if (process.env.CROSSPOST_DOTENV === "1") {
	dotenv.config();
}

const env = new Env();

//-----------------------------------------------------------------------------
// Determine which strategies to use
//-----------------------------------------------------------------------------

/** @type {Array<TwitterStrategy|MastodonStrategy|BlueskyStrategy|LinkedInStrategy|DiscordStrategy>} */
const strategies = [];

if (flags.twitter) {
	strategies.push(
		new TwitterStrategy({
			apiConsumerKey: env.require("TWITTER_API_CONSUMER_KEY"),
			apiConsumerSecret: env.require("TWITTER_API_CONSUMER_SECRET"),
			accessTokenKey: env.require("TWITTER_ACCESS_TOKEN_KEY"),
			accessTokenSecret: env.require("TWITTER_ACCESS_TOKEN_SECRET"),
		}),
	);
}

if (flags.mastodon) {
	strategies.push(
		new MastodonStrategy({
			accessToken: env.require("MASTODON_ACCESS_TOKEN"),
			host: env.require("MASTODON_HOST"),
		}),
	);
}

if (flags.bluesky) {
	strategies.push(
		new BlueskyStrategy({
			identifier: env.require("BLUESKY_IDENTIFIER"),
			password: env.require("BLUESKY_PASSWORD"),
			host: env.require("BLUESKY_HOST"),
		}),
	);
}

if (flags.linkedin) {
	strategies.push(
		new LinkedInStrategy({
			accessToken: env.require("LINKEDIN_ACCESS_TOKEN"),
		}),
	);
}

if (flags.discord) {
	strategies.push(
		new DiscordStrategy({
			botToken: env.require("DISCORD_BOT_TOKEN"),
			channelId: env.require("DISCORD_CHANNEL_ID"),
		}),
	);
}

//-----------------------------------------------------------------------------
// Main
//-----------------------------------------------------------------------------

const client = new Client({ strategies });
const responses = await client.post(message);
let exitCode = 0;

responses.forEach((response, index) => {
	if (isSuccessResponse(response)) {
		console.log(`✅ ${strategies[index].name} succeeded.`);
		console.log(response.response);
	} else {
		exitCode = 1;
		console.log(`❌ ${strategies[index].name} failed.`);
		console.error(response.reason);
	}
});

process.exit(exitCode);
