# Allen & Heath DT168

Direct gain, pad and 48 V control for all 16 microphone inputs. Tested against a real DT168 running A&H control firmware V1.4. This is an independent, unofficial module.

## Setup

Set the DT168 IPv4 address and select the Companion computer's interface on the Dante primary network. The module uses unicast UDP 8700 and receives status on UDP 8702 / multicast 224.0.0.231. The firewall must permit this traffic. The network must pass Dante control multicast. A&H DT Preamp Control and Dante Controller are not required for ongoing module control.

## Gain

Set analogue gain from +5 to +60 dB. This is the gain before the pad. Pad applies -20 dB. For example, analogue gain 25 dB with pad on is displayed as 5 dB by the net gain variable. Gain up/down preserves the current pad and phantom states.

`input_N_gain` matches the rounded net gain shown by DT Preamp Control. `input_N_analogue_gain` shows gain before the pad. `input_N_pad` and `input_N_phantom` contain ON/OFF. `connected` is 1 only while the device responds.

## Actions and presets

Set gain, adjust gain, set/toggle pad, set/toggle phantom and refresh state. Four presets per input provide gain -1 dB, gain +1 dB, pad and phantom. Pad and phantom buttons show actual confirmed state. Add the presets to your button page and select the connection instance when prompted.

The module requests current state before changing a preamp, preserves other flags, waits for confirmation and polls periodically. It does not write preamp settings on connection or reconnection. Changes affect the physical preamp shared by all Dante subscribers.

## Compatibility and validation

Requires Companion 5.0 or later (module API 2.1), tested on Companion 5.1.0, Node 26 module runtime. Direct UDP transport, status reads and writes were tested on 25 October 2026. Gain 20/21 dB, pad on/off and phantom on/off were confirmed on input 16 and the original state restored. Other inputs use the same message structure; they have not all been individually exercised. The source repository includes anonymized protocol fixtures and observed-protocol documentation. This is a public beta; other DT models and firmware versions have not been verified.
