'use strict'
const { InstanceBase, InstanceStatus, Regex, combineRgb } = require('@companion-module/base')
const os = require('node:os')
const { DTClient } = require('./client')
const p = require('./protocol')
const channels = Array.from({ length: 16 }, (_, i) => ({ id: i + 1, label: `Input ${i + 1}` }))
const channelOption = () => ({ type: 'dropdown', id: 'channel', label: 'Input', default: 1, choices: channels })
class DT168Instance extends InstanceBase {
	async init(config) {
		this.config = config
		this.generation = 0
		this.define()
		await this.connect()
	}
	async configUpdated(config) {
		this.config = config
		this.define()
		await this.connect()
	}
	getConfigFields() {
		const interfaces = Object.entries(os.networkInterfaces()).flatMap(([name, list]) =>
			(list || [])
				.filter((i) => i.family === 'IPv4' && !i.internal && i.mac !== '00:00:00:00:00:00')
				.map((i) => ({ id: i.address, label: `${name}: ${i.address}` })),
		)
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'DT168 direct control',
				value:
					'Select the Companion computer network interface on the Dante primary network. UDP 8700/8702 and multicast 224.0.0.231 must pass. No A&H app or Dante Controller is required. Analogue gain is before the 20 dB pad; the gain variable matches the net value shown by DT Preamp Control.',
			},
			{ type: 'textinput', id: 'host', label: 'DT168 IPv4 address', default: '', width: 6, regex: Regex.IP },
			{
				type: 'dropdown',
				id: 'localAddress',
				label: 'Local Dante network interface',
				choices: interfaces,
				default: interfaces[0]?.id || '',
				width: 6,
			},
		]
	}
	async connect() {
		const generation = ++this.generation
		clearTimeout(this.retry)
		clearInterval(this.watchdog)
		this.client?.close()
		this.client = null
		this.online = false
		this.publish()
		if (!this.config.host || !this.config.localAddress) {
			this.updateStatus(InstanceStatus.BadConfig, 'Enter the DT168 IP and select a local network interface')
			return
		}
		this.updateStatus(InstanceStatus.Connecting)
		let client
		try {
			client = new DTClient(this.config.host, this.config.localAddress)
			this.client = client
			client.on('fault', (e) => {
				if (generation === this.generation) this.log('warn', e.message)
			})
			client.on('state', () => {
				if (generation !== this.generation) return
				this.online = true
				this.updateStatus(InstanceStatus.Ok)
				this.publish()
			})
			await client.start()
			if (generation !== this.generation) {
				client.close()
				return
			}
			this.watchdog = setInterval(() => {
				if (Date.now() - client.lastFull > 7000) {
					this.log('warn', 'DT168 stopped responding; reconnecting')
					void this.connect()
				}
			}, 2000)
		} catch (e) {
			client?.close()
			if (generation !== this.generation) return
			this.online = false
			this.publish()
			this.updateStatus(InstanceStatus.ConnectionFailure, e.message)
			this.retry = setTimeout(() => {
				void this.connect()
			}, 5000)
		}
	}
	async destroy() {
		++this.generation
		clearTimeout(this.retry)
		clearInterval(this.watchdog)
		this.client?.close()
	}
	publish() {
		const values = { connected: this.online ? 1 : 0, device_id: this.client?.deviceId || '' }
		for (let ch = 1; ch <= 16; ch++) {
			const state = this.client?.states.get(ch),
				s = state ? p.values(state) : null
			values[`input_${ch}_gain`] = s ? Math.round(s.gain) : ''
			values[`input_${ch}_analogue_gain`] = s ? Math.round(s.analogueGain) : ''
			values[`input_${ch}_pad`] = s ? (s.pad ? 'ON' : 'OFF') : ''
			values[`input_${ch}_phantom`] = s ? (s.phantom ? 'ON' : 'OFF') : ''
		}
		this.setVariableValues(values)
		this.checkAllFeedbacks()
	}
	async act(channel, mutate) {
		if (!this.online || !this.client) throw Error('DT168 is not connected')
		await this.client.change(Number(channel), mutate)
	}
	define() {
		const wrap = (fn) => async (event) => {
			try {
				await fn(event.options)
			} catch (e) {
				this.log('error', e.message)
			}
		}
		const mode = {
			type: 'dropdown',
			id: 'mode',
			label: 'State',
			default: 'toggle',
			choices: [
				{ id: 'toggle', label: 'Toggle' },
				{ id: 'on', label: 'On' },
				{ id: 'off', label: 'Off' },
			],
		}
		const flagAction = (name, bit) => ({
			name,
			options: [channelOption(), mode],
			callback: wrap((o) =>
				this.act(o.channel, (s) => ({
					...s,
					flags: o.mode === 'toggle' ? s.flags ^ bit : o.mode === 'on' ? s.flags | bit : s.flags & ~bit,
				})),
			),
		})
		this.setActionDefinitions({
			set_gain: {
				name: 'Set analogue gain (before pad)',
				options: [
					channelOption(),
					{ type: 'number', id: 'gain', label: 'Analogue gain (5–60 dB)', default: 25, min: 5, max: 60, step: 1 },
				],
				callback: wrap((o) => this.act(o.channel, (s) => ({ ...s, rawGain: p.gainToRaw(Number(o.gain)) }))),
			},
			step_gain: {
				name: 'Adjust gain up/down',
				options: [
					channelOption(),
					{ type: 'number', id: 'step', label: 'Change in dB', default: 1, min: -55, max: 55, step: 1 },
				],
				callback: wrap((o) =>
					this.act(o.channel, (s) => {
						const step = Number(o.step)
						if (!Number.isFinite(step) || step < -55 || step > 55) throw Error('Invalid gain step')
						return {
							...s,
							rawGain: Math.max(p.gainToRaw(5), Math.min(p.gainToRaw(60), s.rawGain + Math.round(step * 256))),
						}
					}),
				),
			},
			pad: flagAction('Pad: on / off / toggle', 1),
			phantom: flagAction('48 V phantom: on / off / toggle', 2),
			refresh: { name: 'Refresh all preamp states', options: [], callback: wrap(() => this.client?.refresh()) },
		})
		const feedback = (name, bit, bg) => ({
			name,
			type: 'boolean',
			defaultStyle: { bgcolor: bg, color: combineRgb(255, 255, 255) },
			options: [channelOption()],
			callback: (event) =>
				this.online && !!((this.client?.states.get(Number(event.options.channel))?.flags || 0) & bit),
		})
		this.setFeedbackDefinitions({
			pad: feedback('Pad is on', 1, combineRgb(0, 120, 0)),
			phantom: feedback('48 V is on', 2, combineRgb(190, 0, 0)),
			connected: {
				name: 'DT168 is connected',
				type: 'boolean',
				defaultStyle: { bgcolor: combineRgb(0, 90, 0) },
				options: [],
				callback: () => this.online,
			},
		})
		this.setVariableDefinitions(
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
					category: `Input ${id}`,
					name: `Input ${id} gain ${step > 0 ? '+1' : '-1'} dB`,
					style: style(`IN ${id}\n$(${this.label}:input_${id}_gain) dB\n${step > 0 ? '+' : '−'}1 dB`),
					steps: [{ down: [{ actionId: 'step_gain', options: { channel: id, step } }], up: [] }],
					feedbacks: [],
				}
			for (const [key, label] of [
				['pad', 'PAD'],
				['phantom', '48 V'],
			])
				presets[`input_${id}_${key}`] = {
					type: 'simple',
					category: `Input ${id}`,
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
		for (const preset of Object.values(presets)) delete preset.category
		const structure = channels.map(({ id }) => ({
			id: `input_${id}`,
			name: `Input ${id}`,
			definitions: [`input_${id}_down`, `input_${id}_up`, `input_${id}_pad`, `input_${id}_phantom`],
		}))
		this.setPresetDefinitions(structure, presets)
	}
}
module.exports = { default: DT168Instance, UpgradeScripts: [] }
