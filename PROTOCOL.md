# Observed DT168 preamp protocol

This is an empirical description of messages observed with DT168 control firmware V1.4, not a vendor-published specification.

## Transport

Send UDP control messages to the DT168 IPv4 address, port 8700. The module sends from an ephemeral port on the explicitly selected local Dante primary interface. Receive status on UDP 8702 and join multicast group 224.0.0.231 on that interface. No Audinate library is linked.

## Envelope

| Offset | Length   | Value                                      |
| ------ | -------- | ------------------------------------------ |
| 0      | 2        | FFFF, big endian                           |
| 2      | 2        | Entire UDP payload length, big endian      |
| 4      | 2        | Sequence, big endian                       |
| 6      | 2        | Zero                                       |
| 8      | 8        | Controller or responding device identifier |
| 16     | 8        | ASCII AllenHth                             |
| 24     | variable | Body                                       |

The tested controller identifier is its selected interface MAC followed by two zero bytes. This form was accepted in direct hardware tests. The identifier is not an authentication mechanism.

## Read all

Body: `01 03 00 00`. Full response body: the same four bytes followed by 16 entries of `[gain u16 little endian][flags u8]`. Entry order is input 1 through 16.

## Set one input / incremental status

Body is 16 bytes: `01 01 00 00`, channel index 0–15, gain u16 little endian, flags u8, then eight zero bytes. Incremental status uses the same layout.

Gain encoding: `32768 + analogue_dB * 256`. Published analogue range: +5 to +60 dB. The protocol retains fractional gain values even though the UI rounds to whole dB. Flag bit 0 is pad and bit 1 is phantom. Other flag bits are preserved.

Gain including pad is analogue gain minus 20 dB while pad is enabled. Before each write the client requests current state, changes the requested field, sends the command and waits for matching device state. The protocol has no atomic field-level update guarantee; concurrent controllers can still race.

## Validation

The golden fixtures use actual captured message shapes with synthetic identifiers. Direct device tests confirmed status reads and gain, pad and phantom writes on input 16. Phantom validation is device-reported state, not an independent electrical voltage measurement. Other DT models, control firmware revisions, domain-managed operation and secondary-only networks remain unverified.
