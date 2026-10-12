# Changelog

## [1.0.9](https://github.com/kakaoenterprise/mocking-gui/compare/v1.0.8...v1.0.9) (2026-10-08)

### Features

- **experimental:** add ./experimental staging entry and entry point policy (ADR-0006) ([#22](https://github.com/kakaoenterprise/mocking-gui/issues/22)) ([1c46b24](https://github.com/kakaoenterprise/mocking-gui/commit/1c46b24a4bfcb38e98d53f30c32fa021a852773a)), references [#18](https://github.com/kakaoenterprise/mocking-gui/issues/18)

## [1.0.8](https://github.com/kakaoenterprise/mocking-gui/compare/v1.0.7...v1.0.8) (2026-10-08)

### Bug Fixes

- **handler:** support colon action paths without path-to-regexp escaping ([#46](https://github.com/kakaoenterprise/mocking-gui/issues/46)) ([1067c60](https://github.com/kakaoenterprise/mocking-gui/commit/1067c60c48fa0aed9cc5772a14966aa5696c1ece)), closes [#44](https://github.com/kakaoenterprise/mocking-gui/issues/44)
- **ssr:** keep the sync cookie under one 4 KB budget and clean up stale cookies ([#47](https://github.com/kakaoenterprise/mocking-gui/issues/47)) ([c75dd69](https://github.com/kakaoenterprise/mocking-gui/commit/c75dd698ca070842a4d3c9ce79fce649706e00d4))
- **style:** make the panel stylesheet independent of the host page's Tailwind and root font-size ([#49](https://github.com/kakaoenterprise/mocking-gui/issues/49)) ([d84ddb8](https://github.com/kakaoenterprise/mocking-gui/commit/d84ddb801555b701f0948dfe40db9a4b1680eea8))

## [1.0.7](https://github.com/kakaoenterprise/mocking-gui/compare/v1.0.6...v1.0.7) (2026-10-08)

### Features

- **examples:** add a showcase demo published with the docs site ([#38](https://github.com/kakaoenterprise/mocking-gui/issues/38)) ([40fdb48](https://github.com/kakaoenterprise/mocking-gui/commit/40fdb48b08b97fd29064c87cc104518d33344c1b))
- **examples:** add a showcase demo published with the docs site ([#40](https://github.com/kakaoenterprise/mocking-gui/issues/40)) ([a37afee](https://github.com/kakaoenterprise/mocking-gui/commit/a37afeebaaa2a5c42fa5043cefd45eb6e2977cc7))

### Bug Fixes

- **server:** stop treating jsdom as a browser in setupMockingServer ([#39](https://github.com/kakaoenterprise/mocking-gui/issues/39)) ([2cb9d7f](https://github.com/kakaoenterprise/mocking-gui/commit/2cb9d7f2feb784eb2c48eb28516fb25a481b8b05))
- **style:** stop switch thumb overshooting the track in Tailwind v4 host apps ([#42](https://github.com/kakaoenterprise/mocking-gui/issues/42)) ([11674cc](https://github.com/kakaoenterprise/mocking-gui/commit/11674cc6a717afcea73e73abcb6978e35b30dbaf))

## [1.0.6](https://github.com/kakaoenterprise/mocking-gui/compare/v1.0.4...v1.0.6) (2026-09-21)

### Bug Fixes

- **scenario:** keep file order when importing scenarios in bulk ([#23](https://github.com/kakaoenterprise/mocking-gui/issues/23)) ([4fe3b8f](https://github.com/kakaoenterprise/mocking-gui/commit/4fe3b8f54c73d04c43e122559724ad7dc1ebf3d2))
- **swagger:** order static handler paths before dynamic ones ([#15](https://github.com/kakaoenterprise/mocking-gui/issues/15)) ([e55bcb3](https://github.com/kakaoenterprise/mocking-gui/commit/e55bcb3bb18bd440a1dcf828632424285247c6e3))
- **worker:** reactivate MSW mocking after tab visibility returns ([#17](https://github.com/kakaoenterprise/mocking-gui/issues/17)) ([3236e89](https://github.com/kakaoenterprise/mocking-gui/commit/3236e8950e4b52c04dd0c6a26393857b1d4d3df2))

All notable changes to `@kakaocloud/mocking-gui` are documented here. Generated from Conventional Commits by release-it.

For releases up to and including 1.0.5, see the [GitHub Releases](https://github.com/kakaoenterprise/mocking-gui/releases) page.
