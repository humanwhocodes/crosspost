/**
 * @fileoverview A CLI for tooting out updates.
 * @author Nicholas C. Zakas
 */

/* eslint-disable no-console */

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
} from "./index.js";

//-----------------------------------------------------------------------------
// Parse CLI Arguments
//-----------------------------------------------------------------------------

const options = {
	twitter: { type: "boolean", short: "t" },
	mastodon: { type: "boolean", short: "m" },
	bluesky: { type: "boolean", short: "b" },
	help: { type: "boolean", short: "h" },
};

const { values: flags, positionals } = parseArgs({
	options,
	allowPositionals: true,
});

if (
	flags.help ||
	positionals.length === 0 ||
	(!flags.twitter && !flags.mastodon && !flags.bluesky)
) {
	console.log('Usage: crosspost [options] "Message to post."');
	console.log("--twitter, -t	Post to Twitter.");
	console.log("--mastodon, -m	Post to Mastodon.");
	console.log("--bluesky, -b	Post to Bluesky.");
	console.log("--help, -h	Show this message.");
	process.exit(1);
}

/*
 * Command line arguments will escape \n as \\n, which isn't what we want.
 * Remove the extra escapes so newlines can be entered on the command line.
 */
const message = positionals[0].replace(/\\n/g, "\n");

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

//-----------------------------------------------------------------------------
// Main
//-----------------------------------------------------------------------------

const client = new Client({ strategies });
const response = await client.post(message);

for (const [service, result] of Object.entries(response)) {
	console.log(`${service} result`);
	console.log(JSON.stringify(result, null, 2));
	console.log("");
}
