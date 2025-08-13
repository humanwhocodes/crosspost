/**
 * @fileoverview Main entry point for the project.
 * @author Nicholas C. Zakas
 */

/* @ts-self-types="./index.d.ts" */

export * from "./types.js";
export {
	BlueskyStrategy,
	BlueskyCreateRecordResponse,
	BlueskyErrorResponse,
	BlueskyImage,
	BlueskyOptions,
	BlueskyPostBody,
	BlueskySession,
	BlueskyUploadBlobResponse,
} from "./strategies/bluesky.js";

export {
	MastodonStrategy,
	MastodonOptions,
	MastodonErrorResponse,
	MastodonMediaAttachment,
	MastodonMediaFocus,
	MastodonMediaResponse,
	MastodonMediaSize,
} from "./strategies/mastodon.js";

export {
	TwitterStrategy,
	TwitterOptions,
	TwitterMediaIdArray,
} from "./strategies/twitter.js";

export * from "./strategies/linkedin.js";
export { DiscordStrategy } from "./strategies/discord.js";
export { DiscordWebhookStrategy } from "./strategies/discord-webhook.js";
export {
	DevtoStrategy,
	DevtoArticle,
	DevtoErrorResponse,
	DevtoOptions,
} from "./strategies/devto.js";
export {
	TelegramStrategy,
	TelegramOptions,
	TelegramMessageResponse,
	TelegramErrorResponse,
} from "./strategies/telegram.js";
export {
	SlackStrategy,
	SlackOptions,
	SlackMessageResponse,
	SlackErrorResponse,
	SlackUploadURLResponse,
	SlackUploadCompleteResponse,
	SlackFileInfo,
	SlackUploadResponse,
	SlackFile,
} from "./strategies/slack.js";
export {
	NostrStrategy,
	NostrOptions,
	NostrPostResponse,
} from "./strategies/nostr.js";
export { Client, ClientOptions, Strategy } from "./client.js";
