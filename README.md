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
    - `LinkedInStrategy`
    - `FacebookStrategy`

Each strategy requires its own parameters that are specific to the service. If you only want to post to a particular service, you can just directly use the strategy for that service.

```js
import {
	Client,
	TwitterStrategy,
	MastodonStrategy,
	BlueskyStrategy,
	LinkedInStrategy,
	FacebookStrategy,
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

// Note: OAuth access token is required
const facebook = new FacebookStrategy({
    accessToken: "your-access-token",
    pageId: "optional-page-id"  // only if posting to a page
});

// create a client that will post to all services
const client = new Client({
    strategies: [bluesky, mastodon, twitter, linkedin, facebook]
});

// post to all services
await client.post("Hello world!");
```

### CLI Usage

Crosspost also has a command line interface to allow for incorporation into CI systems.

```
Usage: crosspost [options] ["Message to post."]
--twitter, -t   Post to Twitter.
--mastodon, -m  Post to Mastodon.
--bluesky, -b   Post to Bluesky.
--linkedin, -l  Post to LinkedIn.
--facebook, -f  Post to Facebook.
--file, -f      The file to read the message from.
--help, -h      Show this message.
```

Example:

```
npx crosspost -t -m -b "Hello world!"

# or

npx @humanwhocodes/crosspost -t -m -b "Hello world!"
```

This posts the message `"Hello world!"` to Twitter, Mastodon, and Bluesky. You can choose to post to any combination by specifying the appropriate command line options.

You can also read the message from a file instead of from the command line:

```
npx crosspost -t -m -b -f message.txt

# or

npx @humanwhocodes/crosspost -t -m -b -f message.txt
```

Each strategy requires a set of environment variables in order to execute:

-   Twitter
    -   `TWITTER_ACCESS_TOKEN_KEY`
    -   `TWITTER_ACCESS_TOKEN_SECRET`
    -   `TWITTER_API_CONSUMER_KEY`
    -   `TWITTER_API_CONSUMER_SECRET`
-   Mastodon
    -   `MASTODON_ACCESS_TOKEN`
    -   `MASTODON_HOST`
-   Bluesky
    -   `BLUESKY_HOST`
    -   `BLUESKY_IDENTIFIER`
    -   `BLUESKY_PASSWORD`
-   LinkedIn
    -   `LINKEDIN_ACCESS_TOKEN`
-   Facebook
    -   `FACEBOOK_ACCESS_TOKEN`
    -   `FACEBOOK_PAGE_ID` (optional - only if posting to a page)

Tip: You can also load environment variables from a `.env` file in the current working directory by setting the environment variable `CROSSPOST_DOTENV` to `1`.

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

### Facebook

You'll need to be a registered for a Meta for Developers account. To do that, go to [Meta for Developers](https://developers.facebook.com/) and click "Get Started."

Once you're registered, follow these steps:

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Click "My Apps"
3. Create a new app or select an existing one - for app type select "consumer", click "Create App".
4. "Add product to your app", Add the "Facebook Login" product to your app
5. Under Facebook Login settings, add "pages_manage_posts" to your permissions
6. Generate a test user access token for development
7. For production:
   - Submit your app for review with the required permissions
   - Once approved, users can authenticate with your app to get access tokens
   - For page posts, request the "pages_manage_posts" permission

**Note:** Access tokens expire. For longer-lasting tokens:
- Use long-lived user access tokens (60 days)
- Or convert to never-expiring page access tokens if posting to a page

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
