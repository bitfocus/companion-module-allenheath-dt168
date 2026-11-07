# Changelog

## 1.0.0-beta.2

- Adopt the Bitfocus JavaScript template, Node.js 26, shared formatting and Yarn dependency protections.
- Report a clear error when refreshing while disconnected.
- Skip cancelled preamp writes and publish only changed Companion values.
- Document valid pad and phantom state expressions.

## 1.0.0-beta.1

First candidate for public beta distribution through Bitfocus.

- Direct DT168 gain, pad and 48 V control on 16 inputs.
- Device state variables, feedback and 64 presets.
- Verified transport with real DT168 hardware and Companion 5.1.0.
- Public setup guide, protocol notes, tests and GitHub workflows.
- Yarn lockfile and prerelease packaging for the official Bitfocus build process.

The earlier 0.1.0 build was a private test package. Action, variable and preset identifiers are retained.
