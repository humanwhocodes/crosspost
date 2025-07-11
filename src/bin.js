#!/usr/bin/env node
/**
 * @fileoverview A CLI for tooting out updates.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import fs from "node:fs";
import { parseArgs } from "node:util";
import * as dotenv from "dotenv";
import { Env } from "@humanwhocodes/env";
import {
	Client,
	TwitterStrategy,
	MastodonStrategy,
	BlueskyStrategy,
	LinkedInStrategy,
	DiscordStrategy,
	DiscordWebhookStrategy,
	DevtoStrategy,
	TelegramStrategy,
	SlackStrategy,
} from "./index.js";
import { CrosspostMcpServer } from "./mcp-server.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/** @typedef {import("./client.js").SuccessResponse} SuccessResponse */
/** @typedef {import("./client.js").Strategy} Strategy */

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
	"discord-webhook": { type: booleanType },
	devto: { type: booleanType },
	telegram: { type: booleanType },
	slack: { type: booleanType, short: "s" },
	mcp: { type: booleanType },
	file: { type: stringType },
	image: { type: stringType },
	"image-alt": { type: stringType },
	help: { type: booleanType, short: "h" },
};

const { values: flags, positionals } = parseArgs({
	options,
	allowPositionals: true,
});

if (flags.mcp && flags.file) {
	console.error("Error: --file cannot be used with --mcp");
	process.exit(1);
}

if (
	flags.help ||
	(!flags.mcp && positionals.length === 0 && !flags.file) ||
	(!flags.twitter &&
		!flags.mastodon &&
		!flags.bluesky &&
		!flags.linkedin &&
		!flags.discord &&
		!flags["discord-webhook"] &&
		!flags.devto &&
		!flags.telegram &&
		!flags.slack &&
		!flags.mcp)
) {
	console.log('Usage: crosspost [options] ["Message to post."]');
	console.log("--twitter, -t	Post to Twitter.");
	console.log("--mastodon, -m	Post to Mastodon.");
	console.log("--bluesky, -b	Post to Bluesky.");
	console.log("--linkedin, -l	Post to LinkedIn.");
	console.log("--discord, -d	Post to Discord via bot.");
	console.log("--discord-webhook	Post to Discord via webhook.");
	console.log("--devto		Post to Dev.to.");
	console.log("--telegram	Post to Telegram.");
	console.log("--slack, -s	Post to Slack.");
	console.log("--mcp		Start MCP server.");
	console.log("--file		The file to read the message from.");
	console.log("--image		The image file to upload with the message.");
	console.log("--image-alt	Alt text for the image (default: filename).");
	console.log("--help, -h	Show this message.");
	process.exit(1);
}

//-----------------------------------------------------------------------------
// Load environment variables
//-----------------------------------------------------------------------------

// load environment variables from .env file if present
if (process.env.CROSSPOST_DOTENV) {
	const filePath =
		process.env.CROSSPOST_DOTENV === "1"
			? undefined
			: process.env.CROSSPOST_DOTENV;
	dotenv.config({ path: filePath });
}

const env = new Env();

//-----------------------------------------------------------------------------
// Determine which strategies to use
//-----------------------------------------------------------------------------

/** @type {Array<Strategy>} */
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

if (flags["discord-webhook"]) {
	strategies.push(
		new DiscordWebhookStrategy({
			webhookUrl: env.require("DISCORD_WEBHOOK_URL"),
		}),
	);
}

if (flags.devto) {
	strategies.push(
		new DevtoStrategy({
			apiKey: env.require("DEVTO_API_KEY"),
		}),
	);
}

if (flags.telegram) {
	strategies.push(
		new TelegramStrategy({
			botToken: env.require("TELEGRAM_BOT_TOKEN"),
			chatId: env.require("TELEGRAM_CHAT_ID"),
		}),
	);
}

if (flags.slack) {
	strategies.push(
		new SlackStrategy({
			botToken: env.require("SLACK_BOT_TOKEN"),
			channel: env.require("SLACK_CHANNEL"),
		}),
	);
}

//-----------------------------------------------------------------------------
// Main
//-----------------------------------------------------------------------------

/** @type {import("./types.js").PostOptions} */
const postOptions = {};

// After strategies are created, start MCP server if requested
if (flags.mcp) {
	const server = new CrosspostMcpServer({ strategies });
	await server.connect(new StdioServerTransport());
	console.error(
		"MCP server started. You can now send messages to it via stdin.",
	);
} else {
	// if an image is specified, read it and add to options
	if (flags.image) {
		try {
			const imageData = fs.readFileSync(flags.image);
			const basename = flags.image.split(/[\\/]/).pop() || flags.image;

			postOptions.images = [
				{
					data: new Uint8Array(imageData),
					alt: flags["image-alt"] || basename,
				},
			];
		} catch (error) {
			const fileError = /** @type {Error} */ (error);
			console.error(`Error reading image file: ${fileError.message}`);
			process.exit(1);
		}
	}

	/*
	 * Command line arguments will escape \n as \\n, which isn't what we want.
	 * Remove the extra escapes so newlines can be entered on the command line.
	 */
	const message = flags.file
		? fs.readFileSync(flags.file, "utf8")
		: positionals[0].replace(/\\n/g, "\n");

	// normal CLI operation
	const client = new Client({ strategies });
	const responses = await client.post(message, postOptions);
	let exitCode = 0;

	responses.forEach((response, index) => {
		if (isSuccessResponse(response)) {
			console.log(`✅ ${strategies[index].name} succeeded.`);
			console.log(response.url ?? response.response);
			console.log("");
		} else {
			exitCode = 1;
			console.log(`❌ ${strategies[index].name} failed.`);
			console.error(response.reason);
			console.log("");
		}
	});

	process.exit(exitCode);
}
