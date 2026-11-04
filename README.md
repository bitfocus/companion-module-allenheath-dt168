# Allen & Heath DT168 for Bitfocus Companion

Independent community module for direct control of the 16 microphone preamps in an Allen & Heath DT168. Maintained by [MiniFido](https://github.com/MiniFido).

**Public beta candidate: 1.0.0-beta.1.** Target: Companion 5.0+ (module API 2.1), tested by the maintainer on Companion 5.1.0 with DT168 control firmware V1.4. Repository allocation and Bitfocus review are pending. The planned Bitfocus repository links in the manifest must be confirmed after allocation.

## Features

- Set analogue gain from +5 to +60 dB and adjust gain in dB steps.
- Set or toggle the -20 dB pad and 48 V phantom power.
- Device-confirmed feedback and gain, pad and phantom variables for all 16 inputs.
- 64 presets: gain down, gain up, pad and phantom per input.
- Periodic status polling and reconnection. Connection startup does not write preamp settings.

Select the DT168 IPv4 address and the local network interface on the Dante primary network. See [the user guide](companion/HELP.md) for setup, variables and gain/pad behavior.

## Build and test

Use Node.js 22.20 or later in the 22.x release line and the pinned Yarn version:

```sh
corepack enable
yarn install --immutable
yarn test
yarn format:check
yarn check
yarn package
```

The package command marks the output as a prerelease. For the official release, push a version tag and submit that tag with **Is Prerelease** enabled in the Bitfocus Developer Portal. A GitHub release alone does not submit it for Bitfocus review.

## Beta scope

Direct UDP transport and status reads were tested against a real DT168. Gain 20/21 dB, pad on/off and phantom on/off were confirmed on input 16, followed by restoration of its original state. The packaged module was tested with Node 22 and the real module-base library, and the maintainer subsequently confirmed operation on Companion 5.1.0.

All channel encodings are covered by tests. Individual physical writes on every channel, multiple DT168 units at once, other operating systems, and other DT models are not yet verified. DT164-W is not advertised as supported. Cross-subnet, redundant-secondary and Dante Domain Manager operation are not verified.

Please report Companion version, OS, DT168 control firmware, local interface selection, affected input and reproduction steps. Never include credentials or raw network captures in public issues.

## Protocol and attribution

The implementation was developed from observation of DT Preamp Control communicating with the maintainer's DT168, followed by direct device tests. [PROTOCOL.md](PROTOCOL.md) documents the observed format and validation limits. Test fixtures retain the captured message structure, with controller/device identifiers replaced by synthetic values. No packet captures, runtime logs, personal network addresses or vendor binaries are included in this repository.

Earlier independent protocol research: [Stoatworks Labs Dante-BabelBox](https://github.com/stoatworks-labs/Dante-BabelBox/blob/main/docs/allenheath-dt-preamp-over-dante.md). Hardware gain limits: [Allen & Heath DT168 technical datasheet](https://www.allen-heath.com/content/uploads/2023/06/DT168-Technical-Datasheet.pdf).

Source code: MIT. This is an unofficial integration and is not endorsed by Allen & Heath or Audinate.
