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
    * `BlueskyStrategy`
    * `MastodonStrategy`
    * `TwitterStrategy`

Each strategy requires its own parameters that are specific to the service. If you only want to post to a particular service, you can just directly use the strategy for that service.

```js
import {
    Client,
    TwitterStrategy,
    MastodonStrategy,
    BlueskyStrategy
} from "@humanwhocodes/crosspost";

// Note: Use an app password, not your login password!
const bluesky = new BlueskyStrategy({
    identifier: "me.you.social",
    password: "your-app-password",
    host: "you.social"
})

// Note: Personal access token is required
const mastodon = new MastodonStrategy({
    accessToken: "your-access-token",
    host: "mastodon.host"
});

// Note: OAuth app is required
const twitter = new TwitterStrategy({
    accessTokenKey: "access-token-key",
    accessTokenSecret: "access-token-secret",
    apiConsumerKey: "api-consumer-key",
    apiConsumerSecret: "api-consumer-secret"
});

// create a client that will post to all three
const client = new Client({
    strategies: [
        bluesky,
        mastodon,
        twitter
    ]
});

// post to all three
await client.post("Hello world!");
```

## License

Apache 2.0
