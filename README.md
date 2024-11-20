# Crosspost

by [Nicholas C. Zakas](https://humanwhocodes.com)

If you find this useful, please consider supporting my work with a [donation](https://humanwhocodes.com/donate) or [nominate me](https://stars.github.com/nominate/) for a GitHub Star.

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

Each strategy requires its own parameters that are specific to the service. If you only want to post to a particular service, you can just directly use the strategy for that service.

```js
import {
	Client,
	TwitterStrategy,
	MastodonStrategy,
	BlueskyStrategy,
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

// create a client that will post to all three
const client = new Client({
	strategies: [bluesky, mastodon, twitter],
});

// post to all three
await client.post("Hello world!");
```

## Setting up Strategies

Each strategy uses the service's preferred way of posting messages, so you'll need to follow specific steps in order to enable API access.

### Twitter

To enable posting on Twitter, you'll need to create a free developer account and an OAuth application. Follow [these instructions](https://humanwhocodes.com/blog/2023/04/automating-tweets-v2-api/).

Generally speaking, if you are creating an app to automate your own posts, you'll be able to use it for free so long as you're not posting a large number of times per day.

### Mastodon

To enable posting to Mastodon, you'll need to create a new application:

1. Log in to your Mastodon server.
1. Click on "Edit Profile".
1. Click on "Development".
1. Click "New Application".
1. Give your application a name.
1. Check off `write:statuses` for your scope.
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

## License

Apache 2.0
