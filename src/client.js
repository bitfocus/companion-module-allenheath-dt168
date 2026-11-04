'use strict'
const { EventEmitter } = require('node:events')
const dgram = require('node:dgram')
const os = require('node:os')
const p = require('./protocol')
class DTClient extends EventEmitter {
	constructor(host, localAddress, options = {}) {
		super()
		this.host = host
		this.localAddress = localAddress
		this.timeout = options.timeout || 2500
		this.states = new Map()
		this.sequence = 0
		this.tail = Promise.resolve()
		this.closed = false
		this.lastFull = 0
		const iface = Object.values(os.networkInterfaces())
			.flat()
			.find((i) => i.address === localAddress && i.family === 'IPv4')
		if (!iface || !iface.mac || iface.mac === '00:00:00:00:00:00')
			throw Error('Select a local IPv4 network interface with a MAC address')
		this.id = Buffer.from(iface.mac.replaceAll(':', '') + '0000', 'hex')
	}
	async start() {
		this.rx = dgram.createSocket({ type: 'udp4', reuseAddr: true })
		this.tx = dgram.createSocket('udp4')
		const message = (b, r) => {
			if (r.address !== this.host) return
			const decoded = p.decode(b)
			if (!decoded) return
			const now = Date.now()
			this.deviceId = decoded.deviceId
			for (const s of decoded.states) this.states.set(s.channel, { ...s, seen: now })
			if (decoded.states.length === 16) this.lastFull = now
			this.emit(
				'state',
				decoded.states.map((s) => p.values(s)),
			)
			this.emit('packet', decoded)
		}
		this.rx.on('message', message)
		this.tx.on('message', message)
		this.rx.on('error', (e) => this.emit('fault', e))
		this.tx.on('error', (e) => this.emit('fault', e))
		try {
			await new Promise((resolve, reject) => {
				this.rx.once('error', reject)
				this.rx.bind(8702, '0.0.0.0', () => {
					this.rx.off('error', reject)
					resolve()
				})
			})
			this.rx.addMembership('224.0.0.231', this.localAddress)
			await new Promise((resolve, reject) => {
				this.tx.once('error', reject)
				this.tx.bind(0, this.localAddress, () => {
					this.tx.off('error', reject)
					resolve()
				})
			})
			await this.refresh()
			this.timer = setInterval(
				() => this.send(p.poll(this.id, ++this.sequence)).catch((e) => this.emit('fault', e)),
				2000,
			)
		} catch (e) {
			this.close()
			throw e
		}
	}
	send(buffer) {
		return new Promise((resolve, reject) => {
			if (this.closed) return reject(Error('Connection closed'))
			this.tx.send(buffer, 8700, this.host, (e) => (e ? reject(e) : resolve()))
		})
	}
	async refresh() {
		if (this.closed) throw Error('Connection closed')
		const reply = this.waitPacket((d) => d.states.length === 16)
		this.send(p.poll(this.id, ++this.sequence)).catch((e) => this.emit('fault', e))
		await reply
		return [...this.states.values()].map(p.values)
	}
	waitPacket(predicate) {
		return new Promise((resolve, reject) => {
			const done = (error, data) => {
				clearTimeout(timer)
				this.off('packet', onPacket)
				this.off('closed', onClose)
				error ? reject(error) : resolve(data)
			}
			const onPacket = (data) => {
				if (predicate(data)) done(null, data)
			}
			const onClose = () => done(Error('Connection closed'))
			const timer = setTimeout(() => done(Error('No confirmed reply from DT168')), this.timeout)
			this.on('packet', onPacket)
			this.once('closed', onClose)
		})
	}
	change(channel, mutate) {
		const action = async () => {
			if (!Number.isInteger(channel) || channel < 1 || channel > 16) throw Error('Channel must be 1–16')
			await this.refresh()
			const before = { ...this.states.get(channel) }
			if (!before || !before.seen) throw Error('No current preamp state')
			const wanted = mutate({ ...before })
			const confirmed = this.waitPacket((d) =>
				d.states.some((s) => s.channel === channel && s.rawGain === wanted.rawGain && s.flags === wanted.flags),
			)
			this.send(p.set(this.id, ++this.sequence, channel, wanted))
				.then(() => this.send(p.poll(this.id, ++this.sequence)))
				.catch((e) => this.emit('fault', e))
			await confirmed
			return { before, after: { ...this.states.get(channel) } }
		}
		const result = this.tail.then(action)
		this.tail = result.catch(() => {})
		return result
	}
	close() {
		if (this.closed) return
		this.closed = true
		clearInterval(this.timer)
		this.emit('closed')
		for (const socket of [this.rx, this.tx]) {
			try {
				socket?.close()
			} catch {}
		}
	}
}
module.exports = { DTClient }
