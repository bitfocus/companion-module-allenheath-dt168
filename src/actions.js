import { channelOption } from './channels.js'
import { gainToRaw } from './protocol.js'

export function updateActions(instance) {
	const wrap = (fn) => async (event, context) => {
		try {
			await fn(event.options, context?.signal)
		} catch (e) {
			if (!context?.signal?.aborted) instance.log('error', e.message)
		}
	}
	const mode = {
		type: 'dropdown',
		id: 'mode',
		label: 'State',
		default: 'toggle',
		expressionDescription: "Must evaluate to 'toggle', 'on', or 'off'.",
		choices: [
			{ id: 'toggle', label: 'Toggle' },
			{ id: 'on', label: 'On' },
			{ id: 'off', label: 'Off' },
		],
	}
	const flagAction = (name, bit) => ({
		name,
		options: [channelOption(), mode],
		callback: wrap((o, signal) =>
			instance.act(
				o.channel,
				(s) => {
					if (!['toggle', 'on', 'off'].includes(o.mode)) throw Error('Invalid preamp state option')
					return { ...s, flags: o.mode === 'toggle' ? s.flags ^ bit : o.mode === 'on' ? s.flags | bit : s.flags & ~bit }
				},
				signal,
			),
		),
	})
	instance.setActionDefinitions({
		set_gain: {
			name: 'Set analogue gain (before pad)',
			options: [
				channelOption(),
				{ type: 'number', id: 'gain', label: 'Analogue gain (5–60 dB)', default: 25, min: 5, max: 60, step: 1 },
			],
			callback: wrap((o, signal) =>
				instance.act(o.channel, (s) => ({ ...s, rawGain: gainToRaw(Number(o.gain)) }), signal),
			),
		},
		step_gain: {
			name: 'Adjust gain up/down',
			options: [
				channelOption(),
				{ type: 'number', id: 'step', label: 'Change in dB', default: 1, min: -55, max: 55, step: 1 },
			],
			callback: wrap((o, signal) =>
				instance.act(
					o.channel,
					(s) => {
						const step = Number(o.step)
						if (!Number.isFinite(step) || step < -55 || step > 55) throw Error('Invalid gain step')
						return {
							...s,
							rawGain: Math.max(gainToRaw(5), Math.min(gainToRaw(60), s.rawGain + Math.round(step * 256))),
						}
					},
					signal,
				),
			),
		},
		pad: flagAction('Pad: on / off / toggle', 1),
		phantom: flagAction('48 V phantom: on / off / toggle', 2),
		refresh: {
			name: 'Refresh all preamp states',
			options: [],
			callback: wrap(() => instance.getConnectedClient().refresh()),
		},
	})
}
