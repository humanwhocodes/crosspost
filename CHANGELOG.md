# Changelog

## [0.8.0](https://github.com/humanwhocodes/crosspost/compare/crosspost-v0.7.0...crosspost-v0.8.0) (2025-03-21)


### ⚠ BREAKING CHANGES

* Remove CommonJS files ([#59](https://github.com/humanwhocodes/crosspost/issues/59))

### Features

* Add strategy to post to dev.to ([#55](https://github.com/humanwhocodes/crosspost/issues/55)) ([0b30203](https://github.com/humanwhocodes/crosspost/commit/0b3020378124c5328b94c27364b0a71b73ae60b8))
* Enable image uploads for Bluesky ([c243128](https://github.com/humanwhocodes/crosspost/commit/c24312820c2207e8ac54f5fddb532c44de995aa0))
* Enable image uploads for Mastodon ([c243128](https://github.com/humanwhocodes/crosspost/commit/c24312820c2207e8ac54f5fddb532c44de995aa0))
* Remove CommonJS files ([#59](https://github.com/humanwhocodes/crosspost/issues/59)) ([62b991e](https://github.com/humanwhocodes/crosspost/commit/62b991e2ea294d88eb491e11a707a2b1f837a672))
* Support image embeedding for Dev.to ([#66](https://github.com/humanwhocodes/crosspost/issues/66)) ([6dde57b](https://github.com/humanwhocodes/crosspost/commit/6dde57b2db37202687ba965a4010e01e258c99ff))
* Support image uploads for Discord bots ([#65](https://github.com/humanwhocodes/crosspost/issues/65)) ([35ce812](https://github.com/humanwhocodes/crosspost/commit/35ce8128be308851b61d91cce1d76a81395d418e))
* Support image uploads for Discord Webhooks ([#64](https://github.com/humanwhocodes/crosspost/issues/64)) ([e05d6f3](https://github.com/humanwhocodes/crosspost/commit/e05d6f363ac34ff65c1b3958ed3cd1fd320de50d))
* Support image uploads for LinkedIn ([#62](https://github.com/humanwhocodes/crosspost/issues/62)) ([ef1fd2b](https://github.com/humanwhocodes/crosspost/commit/ef1fd2bd50ae4db8d829775e31e3fa6b86408928))
* Support image uploads for Twitter ([#61](https://github.com/humanwhocodes/crosspost/issues/61)) ([281a267](https://github.com/humanwhocodes/crosspost/commit/281a267049859c24bd800f2ba2cd5ca1bf50d2d9))
* Support uploading of images ([#60](https://github.com/humanwhocodes/crosspost/issues/60)) ([c243128](https://github.com/humanwhocodes/crosspost/commit/c24312820c2207e8ac54f5fddb532c44de995aa0))


### Bug Fixes

* **deps:** update dependency twitter-api-v2 to v1.20.1 ([#57](https://github.com/humanwhocodes/crosspost/issues/57)) ([9c6b8e0](https://github.com/humanwhocodes/crosspost/commit/9c6b8e06ce541b6c283b6c8fbbeeb64fce2a07e8))

## [0.7.0](https://github.com/humanwhocodes/crosspost/compare/crosspost-v0.6.3...crosspost-v0.7.0) (2025-02-26)


### Features

* Post to Discord via webhook ([#52](https://github.com/humanwhocodes/crosspost/issues/52)) ([820aefe](https://github.com/humanwhocodes/crosspost/commit/820aefe6ca8e05d64a8ce9be8cab3368c6156e33))

## [0.6.3](https://github.com/humanwhocodes/crosspost/compare/crosspost-v0.6.2...crosspost-v0.6.3) (2025-02-19)


### Bug Fixes

* Proper encoding of Bluesky messages ([#48](https://github.com/humanwhocodes/crosspost/issues/48)) ([d79333f](https://github.com/humanwhocodes/crosspost/commit/d79333fc82f8b2d8be35a6cd17e13c85b67f509f))

## [0.6.2](https://github.com/humanwhocodes/crosspost/compare/crosspost-v0.6.1...crosspost-v0.6.2) (2025-02-19)


### Bug Fixes

* Ensure newlines are not escaped in Bluesky messages ([#46](https://github.com/humanwhocodes/crosspost/issues/46)) ([1a2dd0a](https://github.com/humanwhocodes/crosspost/commit/1a2dd0a2fcfa8c8907b861ce656e540e04721922))

## [0.6.1](https://github.com/humanwhocodes/crosspost/compare/crosspost-v0.6.0...crosspost-v0.6.1) (2025-02-18)


### Bug Fixes

* Ensure Emojis are properly encoded for Bluesky ([#44](https://github.com/humanwhocodes/crosspost/issues/44)) ([8be367d](https://github.com/humanwhocodes/crosspost/commit/8be367d16a18e06e5de7f00338523bd1f32f57a9))

## [0.6.0](https://github.com/humanwhocodes/crosspost/compare/crosspost-v0.5.0...crosspost-v0.6.0) (2025-02-18)


### Features

* Add strategy to post to Discord ([#43](https://github.com/humanwhocodes/crosspost/issues/43)) ([81168c7](https://github.com/humanwhocodes/crosspost/commit/81168c7bab230b55988f1a73f35abdeee7d82c0a))


### Bug Fixes

* **deps:** update dependency @humanwhocodes/env to v4 ([#32](https://github.com/humanwhocodes/crosspost/issues/32)) ([7a2f838](https://github.com/humanwhocodes/crosspost/commit/7a2f83814f5b8e5936e5facd0b0dd3140451f3e4))

## [0.5.0](https://github.com/humanwhocodes/crosspost/compare/crosspost-v0.4.0...crosspost-v0.5.0) (2025-02-14)


### Features

* Add strategy to post to LinkedIn ([#38](https://github.com/humanwhocodes/crosspost/issues/38)) ([401c06d](https://github.com/humanwhocodes/crosspost/commit/401c06df7db13d6447f3765b452b7e2df718eb53))


### Bug Fixes

* Include error details in Bluesky failures ([25e79b4](https://github.com/humanwhocodes/crosspost/commit/25e79b4cfcfe2226636abc4d07f92cea6c245267))
* Remove -f shortcut for --file option ([#39](https://github.com/humanwhocodes/crosspost/issues/39)) ([e01d384](https://github.com/humanwhocodes/crosspost/commit/e01d3846967c77ffc8e33467a460aba9248a6476))

## [0.4.0](https://github.com/humanwhocodes/crosspost/compare/crosspost-v0.3.1...crosspost-v0.4.0) (2025-02-11)


### Features

* Allow file input for CLI ([#36](https://github.com/humanwhocodes/crosspost/issues/36)) ([67ce231](https://github.com/humanwhocodes/crosspost/commit/67ce23187d0a5c064cacc963bf46c39b66e25e60))


### Bug Fixes

* **deps:** update dependency twitter-api-v2 to v1.19.0 ([#29](https://github.com/humanwhocodes/crosspost/issues/29)) ([ef0241e](https://github.com/humanwhocodes/crosspost/commit/ef0241e06063ddd3f902c4cf6f872efcaaca19cb))

## [0.3.1](https://github.com/humanwhocodes/crosspost/compare/crosspost-v0.3.0...crosspost-v0.3.1) (2025-01-08)


### Bug Fixes

* CLI should exit with non-zero code when a strategy fails ([37e48e7](https://github.com/humanwhocodes/crosspost/commit/37e48e7caacda09cc9a5f4bfea9615811ec7c8a7))
* **deps:** update dependency dotenv to v16.4.7 ([#27](https://github.com/humanwhocodes/crosspost/issues/27)) ([44b5942](https://github.com/humanwhocodes/crosspost/commit/44b59420e28606cabb34465ba955afa1ba9c8af7))

## [0.3.0](https://github.com/humanwhocodes/crosspost/compare/crosspost-v0.2.1...crosspost-v0.3.0) (2024-12-30)


### ⚠ BREAKING CHANGES

* Client#post() always returns array of responses ([#23](https://github.com/humanwhocodes/crosspost/issues/23))

### Features

* Client#post() always returns array of responses ([#23](https://github.com/humanwhocodes/crosspost/issues/23)) ([976b500](https://github.com/humanwhocodes/crosspost/commit/976b500e1380de1e943839b86bd800469e0f771e))


### Bug Fixes

* **deps:** update dependency twitter-api-v2 to v1.18.2 ([#18](https://github.com/humanwhocodes/crosspost/issues/18)) ([18a60a3](https://github.com/humanwhocodes/crosspost/commit/18a60a3d1729ad06c59aaa34c00a0082885f8517))

## [0.2.1](https://github.com/humanwhocodes/crosspost/compare/crosspost-v0.2.0...crosspost-v0.2.1) (2024-12-13)


### Bug Fixes

* Detect URLs in posts ([#20](https://github.com/humanwhocodes/crosspost/issues/20)) ([eabc46a](https://github.com/humanwhocodes/crosspost/commit/eabc46a32c451be513cb9ee9d238aa50d2e407e6))

## [0.2.0](https://github.com/humanwhocodes/crosspost/compare/crosspost-v0.1.1...crosspost-v0.2.0) (2024-11-22)


### Features

* Add CLI ([#12](https://github.com/humanwhocodes/crosspost/issues/12)) ([fda0ccb](https://github.com/humanwhocodes/crosspost/commit/fda0ccb4b4dad803f4f4666b2cc212d85129ba9a))

## [0.1.1](https://github.com/humanwhocodes/crosspost/compare/crosspost-v0.1.0...crosspost-v0.1.1) (2024-11-21)


### Bug Fixes

* Ensure package is built before publish ([892ce01](https://github.com/humanwhocodes/crosspost/commit/892ce016966d30829188530104782c7c15478a2b))
* Update package.json description ([1fec773](https://github.com/humanwhocodes/crosspost/commit/1fec77334b8d881c65abdf958abd48fe95045a6e))

## 0.1.0 (2024-11-19)


### Features

* Bluesky strategy ([16b81a0](https://github.com/humanwhocodes/crosspost/commit/16b81a0e44f9e549f002b24c66ab04b984d310f8))
* Ready first release ([3af8c9d](https://github.com/humanwhocodes/crosspost/commit/3af8c9d55fb696e54ec8897d13bf66ee97628165))
* Switch Bluesky to custom API implementation ([7c07e90](https://github.com/humanwhocodes/crosspost/commit/7c07e900368e57668bf7c50112c08ded3e283af3))


### Bug Fixes

* JSR entrypoing (again) ([42eb597](https://github.com/humanwhocodes/crosspost/commit/42eb5976b8231cc4ce40f7c769cb20658259d80a))
* JSR entrypoint ([3f1cf90](https://github.com/humanwhocodes/crosspost/commit/3f1cf905163e7aa24c148ae90bff1f23547961eb))
* Type locations and license ([62034f5](https://github.com/humanwhocodes/crosspost/commit/62034f57d4065fa5f9561e57d862a5875ccc677c))
