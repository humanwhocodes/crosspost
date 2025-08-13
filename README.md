# Crosspost

by [Nicholas C. Zakas](https://humanwhocodes.com)

If you find this useful, please consider supporting my work with a [donation](https://humanwhocodes.com/donate).

## Description

A utility for posting across multiple social networks at once.

## Installation

```shell
npm install @humanwhocodes/crosspost
```

## Usage

### API Usage

The API is split into two parts:

1. The `Client` class that can be used to post the same message across multiple services.
1. A number of different strategy implementations, one for each service:
    - `BlueskyStrategy`
    - `MastodonStrategy`
    - `TwitterStrategy`
    - `LinkedInStrategy`
    - `DiscordStrategy`
    - `DiscordWebhookStrategy`
    - `TelegramStrategy`
    - `DevtoStrategy`
    - `NostrStrategy`

Each strategy requires its own parameters that are specific to the service. If you only want to post to a particular service, you can just directly use the strategy for that service.

```js
import {
	Client,
	TwitterStrategy,
	MastodonStrategy,
	BlueskyStrategy,
	LinkedInStrategy,
	DiscordStrategy,
	DiscordWebhookStrategy,
	TelegramStrategy,
	DevtoStrategy,
	NostrStrategy,
} from "@humanwhocodes/crosspost";

// Note: Use an app password, not your login password!
const bluesky = new BlueskyStrategy({
	identifier: "me.you.social",
	password: "your-app-password",
	host: "you.social", // "bsky.social" for most people
});

// Note: Personal access token is required
const mastodon = new MastodonStrategy({
	accessToken: "your-access-token",
	host: "mastodon.host",
});

// Note: OAuth app is required
const twitter = new TwitterStrategy({
	accessTokenKey: "access-token-key",
	accessTokenSecret: "access-token-secret",
	apiConsumerKey: "api-consumer-key",
	apiConsumerSecret: "api-consumer-secret",
});

// Note: OAuth access token is required
const linkedin = new LinkedInStrategy({
	accessToken: "your-access-token",
});

// Note: Bot token and channel ID required
const discord = new DiscordStrategy({
	botToken: "your-bot-token",
	channelId: "your-channel-id",
});

// Note: Webhook URL required
const discordWebhook = new DiscordWebhookStrategy({
	webhookUrl: "your-webhook-url",
});

// Note: Bot token and chat ID required
const telegram = new TelegramStrategy({
	botToken: "your-bot-token",
	chatId: "your-chat-id",
});

// Note: API key required
const devto = new DevtoStrategy({
	apiKey: "your-api-key",
});

// Note: Private key (nsec or hex) and relays required
const nostr = new NostrStrategy({
	privateKey: "your-private-key", // nsec... or hex format
	relays: ["wss://relay.damus.io", "wss://nos.lol"], // array of relay URLs
});

// create a client that will post to all services
const client = new Client({
	strategies: [
		bluesky,
		mastodon,
		twitter,
		linkedin,
		discord,
		discordWebhook,
		telegram,
		devto,
		nostr,
	],
});

// post to all services with up to 4 images (must be PNG, JPEG, or GIF)
// Note: Nostr doesn't support direct image uploads - images will be ignored for Nostr posts
await client.post("Hello world!", {
	images: [
		{
			data: imageData, // Uint8Array of image data
			alt: "Description of the image",
		},
	],
});

// post to all services with an abort signal
const controller = new AbortController();
await client.post("Hello world!", { signal: controller.signal });

// post to specific services using postTo
await client.postTo([
	{
		message: "Hello Twitter!",
		strategyId: "twitter", // Uses the strategy's id property
	},
	{
		message: "Hello Mastodon and Bluesky!",
		strategyId: "mastodon",
		images: [
			{
				data: imageData, // Uint8Array of image data
				alt: "Description of the image",
			},
		],
	},
	{
		message: "Hello Bluesky!",
		strategyId: "bluesky",
	},
]);

// post to specific services with a signal
await client.postTo(
	[
		{
			message: "Hello Twitter!",
			strategyId: "twitter",
		},
		{
			message: "Hello Mastodon!",
			strategyId: "mastodon",
		},
	],
	{ signal: controller.signal },
);
```

### CLI Usage

Crosspost also has a command line interface to allow for incorporation into CI systems.

```
Usage: crosspost [options] ["Message to post."]
--twitter, -t   Post to Twitter.
--mastodon, -m  Post to Mastodon.
--bluesky, -b   Post to Bluesky.
--linkedin, -l  Post to LinkedIn.
--discord, -d   Post to Discord via bot.
--discord-webhook  Post to Discord via webhook.
--devto         Post to dev.to.
--telegram      Post to Telegram.
--nostr, -n     Post to Nostr.
--mcp           Start MCP server.
--file          The file to read the message from.
--image         The image file to upload with the message.
--image-alt     Alt text for the image (defaults: filename).
--help, -h      Show this message.
```

Examples:

```shell
# Post a message to multiple services
npx @humanwhocodes/crosspost -t -m -b "Check out this beach!"

# Post a message with an image to multiple services
npx @humanwhocodes/crosspost -t -m -b --image ./photo.jpg --image-alt "A beautiful sunset" "Check out this beach!"
```

This posts the message `"Hello world!"` to Twitter, Mastodon, and Bluesky with an attached image. You can choose to post to any combination by specifying the appropriate command line options.

You can also read the message from a file instead of from the command line:

```shell
# Post a message to multiple services
npx @humanwhocodes/crosspost -t -m -b -f message.txt

# Post a message with an image to multiple services
npx @humanwhocodes/crosspost -t -m -b -f message.txt -i path/to/image.jpg
```

Each strategy requires a set of environment variables in order to execute:

- Twitter
    - `TWITTER_ACCESS_TOKEN_KEY`
    - `TWITTER_ACCESS_TOKEN_SECRET`
    - `TWITTER_API_CONSUMER_KEY`
    - `TWITTER_API_CONSUMER_SECRET`
- Mastodon
    - `MASTODON_ACCESS_TOKEN`
    - `MASTODON_HOST`
- Bluesky
    - `BLUESKY_HOST`
    - `BLUESKY_IDENTIFIER`
    - `BLUESKY_PASSWORD`
- LinkedIn
    - `LINKEDIN_ACCESS_TOKEN`
- Discord
    - `DISCORD_BOT_TOKEN`
    - `DISCORD_CHANNEL_ID`
- Discord Webhook
    - `DISCORD_WEBHOOK_URL`
- dev.to
    - `DEVTO_API_KEY`
- Telegram
    - `TELEGRAM_BOT_TOKEN`
    - `TELEGRAM_CHAT_ID`
- Slack
    - `SLACK_TOKEN`
    - `SLACK_CHANNEL`
- Nostr
    - `NOSTR_PRIVATE_KEY`
    - `NOSTR_RELAYS`

Tip: You can load environment variables from a `.env` file by setting the environment variable `CROSSPOST_DOTENV`. Set it to `1` to use `.env` in the current working directory, or set it to a specific filepath to use a different location.

### MCP Server Usage

Crosspost can be run as an MCP (Model Context Protocol) server, which allows it to be used by AI agents:

```shell
npx @humanwhocodes/crosspost --mcp -t -m -b -n
```

This starts an MCP server that can post to Twitter, Mastodon, Bluesky, and Nostr. The server provides prompts and tools for posting to all services or individual services. Only the services indicated by the flags are available via the server.

To run the MCP server through the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) for debugging purposes, run the following command:

```shell
npx run mcp:inspect -- -t -m -b -n
```

#### Using the MCP Server with Claude Desktop

To use the MCP server with Claude you must have [Node.js](https://nodejs.org) installed.
Then, in Claude Desktop:

1. Click on File -> Settings.
1. Select "Developer".
1. Click "Edit Config".

Claude will then create a `claude_desktop_config.json` file. Open it and add the following:

```json
{
	"mcpServers": {
		"crosspost": {
			"command": "npx",
			"args": ["@humanwhocodes/crosspost", "-m", "-l", "-n", "--mcp"],
			"env": {
				"LINKEDIN_ACCESS_TOKEN": "abcdefghijklmnop",
				"MASTODON_ACCESS_TOKEN": "abcdefghijklmnop",
				"MASTODON_HOST": "mastodon.social",
				"NOSTR_PRIVATE_KEY": "nsec1...",
				"NOSTR_RELAYS": "wss://relay.damus.io,wss://nos.lol"
			}
		}
	}
}
```

This example enables Mastodon, LinkedIn, and Nostr so the `env` key contains the environment variables necessary to post to those services. You can customize the services by passing different command line arguments as you would using the CLI.

If you'd prefer not to put your environment variables directly into the JSON file, you can create a [`.env` file](https://www.npmjs.com/package/dotenv) and use the `CROSSPOST_DOTENV` environment variable to point to it:

```json
{
	"mcpServers": {
		"crosspost": {
			"command": "npx",
			"args": ["@humanwhocodes/crosspost", "-m", "-l", "-t", "-n", "--mcp"],
			"env": {
				"CROSSPOST_DOTENV": "/usr/nzakas/settings/.env"
			}
		}
	}
}
```

Here are some prompts you can try:

- "Crosspost this message: Hello world!" (posts to all available services)
- "Post this to Twitter: Hello X!" (posts just to Twitter)
- "Post this to Mastodon and Bluesky: Hello friends!" (posts to Mastodon and Bluesky)
- "Post this to Nostr: Hello decentralized world!" (posts just to Nostr)

## Setting up Strategies

Each strategy uses the service's preferred way of posting messages, so you'll need to follow specific steps in order to enable API access.

### Twitter

To enable posting on Twitter, you'll need to create a free developer account and an OAuth application. Follow [these instructions](https://humanwhocodes.com/blog/2023/04/automating-tweets-v2-api/).

Generally speaking, if you are creating an app to automate your own posts, you'll be able to use it for free so long as you're not posting a large number of times per day.

**Note:** The post uses the terms "app key" and "app secret" whereas the Twitter strategy here uses "API consumer key" and "API consumer secret". They are the same values.

### Mastodon

To enable posting to Mastodon, you'll need to create a new application:

1. Log in to your Mastodon server.
1. Click on "Edit Profile".
1. Click on "Development".
1. Click "New Application".
1. Give your application a name.
1. Check off `write:statuses` for your scope. If you want to upload images, check off `write:media` too.
1. Click "Submit".

This will generate a client key, client secret, and access token. You only need to use the access token when posting via the API.

### Bluesky

Bluesky doesn't require an application for automated posts, only your identifier and an app password. To generate an app password:

1. Log in to your Bluesky account.
1. Click "Settings".
1. Click "Privacy and Security."
1. Click "App Passwords".
1. Click "Add App Password".
1. Name your app password and click "Next".
1. Copy the generated password and click "Done".

**Important:** Do not use your login password with the API.

### LinkedIn

To enable posting to LinkedIn, follow these steps:

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/).
2. Click "Create app".
3. Fill in your application details.
4. Click "Create App" (yes, again).
5. Click on the "Settings" tab.
6. Next to "LinkedIn Page" click "Verify".
7. Go to the generated URL to link your page to your app.
8. Under "Available Products", request access to "Share on LinkedIn" and "Sign in with LinkedIn using OpenID Connect".
9. Go to [OAuth 2.0 Tools](https://www.linkedin.com/developers/tools/oauth) and click "Create Token".
10. Select your app from the dropdown.
11. Check the box next to `openid`, `profile` and `w_member_social` scopes.
12. Click "Request Access Token".
13. Use your profile to grant access to your app by clicking "Allow".

**Important:** Tokens automatically expire after two months.

### Discord Bot

To enable posting to Discord using a bot, you'll need to create a bot and get its token:

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click "New Application".
3. Give your application a name and click "Create".
4. Click "Installation" in the left sidebar.
5. Under "Install Link" select "None".
6. Click "Save Changes".
7. Click on "Bot" in the left sidebar.
8. Uncheck "Public Bot" to ensure no one else can add this bot.
9. Under "Text Permissions" check "Send Messages".
10. Click "Save Changes".
11. Click "Reset Token" and copy the bot token that appears.

To add the bot to your server:

1. In the Developer Portal, click on "OAuth2" in the left sidebar.
2. Under "OAuth2 URL Generator", check "bot".
3. Under "Bot Permissions", check "Send Messages" under "Text Permissions".
4. Copy the generated URL and open it in your browser.
5. Select your server and authorize the bot.

To get your channel ID:

1. Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode).
2. Right-click the channel you want to post to.
3. Click "Copy Channel ID".

**Note:** By default your application will only be able to send messages to public channels. To send messages to private channels, you'll have to give your application the necessary permissions.

### Discord Webhook

To enable posting to Discord using a webhook, you'll need to create a webhook and get its URL:

1. Open Discord and navigate to the server you want to create the webhook for.
2. Click on the server name at the top of the channel list to open the server settings.
3. In the server settings, click on "Integrations" in the left sidebar.
4. Click on "Webhooks".
5. Click the "New Webhook" button.
6. Give your webhook a name and select the channel you want to post to.
7. Click the "Copy Webhook URL" button to copy the webhook URL.
8. Click "Save Changes".

Use the copied webhook URL as the `webhookUrl` parameter in the `DiscordWebhookStrategy` configuration.

### Dev.to

To enable posting to Dev.to:

1. Log in to your [Dev.to](https://dev.to) account.
2. Click on your profile picture in the top right.
3. Click "Settings".
4. Click "Extensions" in the left sidebar.
5. Scroll down to "DEV Community API Keys".
6. Enter a description for your API key and click "Generate API Key".
7. Copy the generated API key.

Use this API key as the value for the `DEVTO_API_KEY` environment variable when using the CLI.

The first line of your post will be used as the article title on Dev.to.

### Telegram

To enable posting to Telegram using a bot:

1. Start a chat with [@BotFather](https://t.me/BotFather) on Telegram.
2. Send the command `/newbot`.
3. Follow the prompts to create a new bot:
    - Provide a name for your bot (e.g., "My Crosspost Bot")
    - Provide a username for your bot (must end with "bot", e.g., "mycrosspost_bot")
4. BotFather will provide you with a token, which will look something like `4839574812:AAFD39kkdpWt3ywyRZergyOLMaJhac60qc`.
5. Copy this token and use it as the value for the `TELEGRAM_BOT_TOKEN` environment variable.

For the `TELEGRAM_CHAT_ID` (required):

- You can specify any Telegram username such as `@username`.
- To get your own chat ID, you can message [@userinfobot](https://t.me/userinfobot) on Telegram.
- For group chat IDs, add your bot to the group and use a service like [@RawDataBot](https://t.me/RawDataBot) to get the chat ID.
- Set the value as the `TELEGRAM_CHAT_ID` environment variable.

### Slack

To enable posting to Slack using a bot:

1. Go to the [Slack API website](https://api.slack.com/apps) and click "Create New App".
2. Select "From scratch" and provide an app name and select your Slack workspace.
3. Click "Create App".
4. In the left sidebar, click "OAuth & Permissions".
5. Scroll down to "Scopes" and under "Bot Token Scopes", add the following scopes:
    - `chat:write` - Send messages as the bot user
    - `files:write` - Upload files as the bot user (required for image support)
6. Scroll to the top and click "Install to Workspace".
7. Review the permissions and click "Allow".
8. Copy the "Bot User OAuth Token" that starts with `xoxb-`. This is your `SLACK_TOKEN`.

To get your channel ID:

1. In Slack, right-click on the channel you want to post to.
2. Select "Copy link".
3. The channel ID is the part after the last slash in the URL (e.g., `C1234567890`).
4. Alternatively, you can use the channel name (e.g., `#general`).

Use the bot token as the `SLACK_TOKEN` environment variable and the channel ID or name as the `SLACK_CHANNEL` environment variable.

**Note:** The bot must be added to the channel you want to post to. You can do this by mentioning the bot in the channel (e.g., `@your-bot-name`) or by using the `/invite @your-bot-name` command.

**Note:** Your bot can only send messages to users who have previously messaged the bot or added it to a group.

### Nostr

To enable posting to Nostr, you'll need a private key and a list of relays:

1. **Private Key**: You can use either:
   - An nsec-formatted private key (starts with `nsec1`)
   - A hex-formatted private key (64-character hex string)
   
   To generate a new key pair, you can use any Nostr client or library, or generate one programmatically:
   ```js
   import { generateSecretKey } from "nostr-tools/pure";
   import * as nip19 from "nostr-tools/nip19";
   
   const secretKey = generateSecretKey();
   const nsecKey = nip19.nsecEncode(secretKey);
   console.log("Your nsec private key:", nsecKey);
   ```

2. **Relays**: You'll need a list of Nostr relays to publish your notes to. Popular public relays include:
   - `wss://relay.damus.io`
   - `wss://nos.lol`
   - `wss://relay.nostr.band`
   - `wss://nostr.wine`
   - `wss://relay.primal.net`

3. **Environment Variables**:
   - `NOSTR_PRIVATE_KEY`: Your private key (nsec or hex format)
   - `NOSTR_RELAYS`: Comma-separated list of relay URLs

**Important Security Notes:**
- Keep your private key secure and never share it publicly
- Consider using a dedicated key pair for automated posting
- The private key gives full control over the Nostr identity

**Note:** Nostr doesn't support direct image uploads like other platforms. If you want to include images, upload them to an external service (like a CDN or image hosting service) and include the URLs in your message text.

## License

Copyright 2024-2025 Nicholas C. Zakas

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
