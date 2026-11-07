import { channels } from './channels.js'

export function updateVariables(instance) {
	instance.setVariableDefinitions(
		Object.fromEntries(
			[
				{ variableId: 'connected', name: 'Connected (1 / 0)' },
				{ variableId: 'device_id', name: 'DT168 device identifier' },
				...channels.flatMap(({ id }) => [
					{ variableId: `input_${id}_gain`, name: `Input ${id}: gain including pad (dB)` },
					{ variableId: `input_${id}_analogue_gain`, name: `Input ${id}: analogue gain before pad (dB)` },
					{ variableId: `input_${id}_pad`, name: `Input ${id}: pad ON/OFF` },
					{ variableId: `input_${id}_phantom`, name: `Input ${id}: 48 V ON/OFF` },
				]),
			].map(({ variableId, ...definition }) => [variableId, definition]),
		),
	)
}
