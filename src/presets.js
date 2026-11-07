import { combineRgb } from '@companion-module/base'
import { channels } from './channels.js'

export function updatePresets(instance) {
	const presets = {}
	const style = (text, bg = combineRgb(25, 25, 25)) => ({
		text,
		size: 'auto',
		color: combineRgb(255, 255, 255),
		bgcolor: bg,
	})
	for (const { id } of channels) {
		for (const [suffix, step] of [
			['down', -1],
			['up', 1],
		])
			presets[`input_${id}_${suffix}`] = {
				type: 'simple',
				name: `Input ${id} gain ${step > 0 ? '+1' : '-1'} dB`,
				style: style(`IN ${id}\n$(${instance.label}:input_${id}_gain) dB\n${step > 0 ? '+' : '−'}1 dB`),
				steps: [{ down: [{ actionId: 'step_gain', options: { channel: id, step } }], up: [] }],
				feedbacks: [],
			}
		for (const [key, label] of [
			['pad', 'PAD'],
			['phantom', '48 V'],
		])
			presets[`input_${id}_${key}`] = {
				type: 'simple',
				name: `Input ${id} ${label}`,
				style: style(`IN ${id}\n${label}`),
				steps: [{ down: [{ actionId: key, options: { channel: id, mode: 'toggle' } }], up: [] }],
				feedbacks: [
					{
						feedbackId: key,
						options: { channel: id },
						style: { bgcolor: key === 'pad' ? combineRgb(0, 120, 0) : combineRgb(190, 0, 0) },
					},
				],
			}
	}
	const structure = channels.map(({ id }) => ({
		id: `input_${id}`,
		name: `Input ${id}`,
		definitions: [`input_${id}_down`, `input_${id}_up`, `input_${id}_pad`, `input_${id}_phantom`],
	}))
	instance.setPresetDefinitions(structure, presets)
}
