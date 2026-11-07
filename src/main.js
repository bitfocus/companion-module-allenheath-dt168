import { InstanceBase, InstanceStatus, Regex } from '@companion-module/base'
import os from 'node:os'
import { DTClient } from './client.js'
import { values as preampValues } from './protocol.js'
import { updateActions } from './actions.js'
import { updateFeedbacks } from './feedbacks.js'
import { updateVariables } from './variables.js'
import { updatePresets } from './presets.js'

export { UpgradeScripts } from './upgrades.js'

export default class DT168Instance extends InstanceBase {
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
				if (!this.online) {
					this.online = true
					this.updateStatus(InstanceStatus.Ok)
				}
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
				s = state ? preampValues(state) : null
			values[`input_${ch}_gain`] = s ? Math.round(s.gain) : ''
			values[`input_${ch}_analogue_gain`] = s ? Math.round(s.analogueGain) : ''
			values[`input_${ch}_pad`] = s ? (s.pad ? 'ON' : 'OFF') : ''
			values[`input_${ch}_phantom`] = s ? (s.phantom ? 'ON' : 'OFF') : ''
		}
		const changes = Object.fromEntries(
			Object.entries(values).filter(([key, value]) => this.publishedValues?.[key] !== value),
		)
		this.publishedValues = values
		const keys = Object.keys(changes)
		if (keys.length) this.setVariableValues(changes)
		if (keys.some((key) => key === 'connected' || key.endsWith('_pad') || key.endsWith('_phantom')))
			this.checkAllFeedbacks()
	}
	getConnectedClient() {
		if (!this.online || !this.client) throw Error('DT168 is not connected')
		return this.client
	}
	async act(channel, mutate, signal) {
		signal?.throwIfAborted()
		await this.getConnectedClient().change(Number(channel), mutate, signal)
	}
	define() {
		updateActions(this)
		updateFeedbacks(this)
		updateVariables(this)
		updatePresets(this)
	}
}
