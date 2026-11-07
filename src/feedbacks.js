import { combineRgb } from '@companion-module/base'
import { channelOption } from './channels.js'

export function updateFeedbacks(instance) {
	const feedback = (name, bit, bg) => ({
		name,
		type: 'boolean',
		defaultStyle: { bgcolor: bg, color: combineRgb(255, 255, 255) },
		options: [channelOption()],
		callback: (event) =>
			instance.online && !!((instance.client?.states.get(Number(event.options.channel))?.flags || 0) & bit),
	})
	instance.setFeedbackDefinitions({
		pad: feedback('Pad is on', 1, combineRgb(0, 120, 0)),
		phantom: feedback('48 V is on', 2, combineRgb(190, 0, 0)),
		connected: {
			name: 'DT168 is connected',
			type: 'boolean',
			defaultStyle: { bgcolor: combineRgb(0, 90, 0) },
			options: [],
			callback: () => instance.online,
		},
	})
}
