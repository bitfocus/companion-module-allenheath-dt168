'use strict'
const VENDOR = Buffer.from('AllenHth')
function envelope(id, seq, body) {
	if (!Buffer.isBuffer(id) || id.length !== 8) throw Error('Controller ID must contain eight bytes')
	const out = Buffer.alloc(24 + body.length)
	out.writeUInt16BE(0xffff, 0)
	out.writeUInt16BE(out.length, 2)
	out.writeUInt16BE(seq & 0xffff, 4)
	id.copy(out, 8)
	VENDOR.copy(out, 16)
	body.copy(out, 24)
	return out
}
function poll(id, seq) {
	return envelope(id, seq, Buffer.from([1, 3, 0, 0]))
}
function set(id, seq, channel, state) {
	if (!Number.isInteger(channel) || channel < 1 || channel > 16) throw Error('Channel must be 1–16')
	if (
		!Number.isInteger(state.rawGain) ||
		state.rawGain < 0 ||
		state.rawGain > 0xffff ||
		!Number.isInteger(state.flags) ||
		state.flags < 0 ||
		state.flags > 255
	)
		throw Error('Invalid preamp state')
	const body = Buffer.alloc(16)
	body.set([1, 1, 0, 0, channel - 1])
	body.writeUInt16LE(state.rawGain, 5)
	body[7] = state.flags
	return envelope(id, seq, body)
}
function decode(b) {
	if (
		b.length < 28 ||
		b.readUInt16BE(0) !== 0xffff ||
		b.readUInt16BE(2) !== b.length ||
		!b.subarray(16, 24).equals(VENDOR)
	)
		return null
	if (b[24] !== 1 || b[26] || b[27]) return null
	if (b[25] === 3 && b.length === 76) {
		return {
			deviceId: b.subarray(8, 16).toString('hex'),
			states: Array.from({ length: 16 }, (_, i) => ({
				channel: i + 1,
				rawGain: b.readUInt16LE(28 + i * 3),
				flags: b[30 + i * 3],
			})),
		}
	}
	if (b[25] === 1 && b.length === 40 && b[28] < 16)
		return {
			deviceId: b.subarray(8, 16).toString('hex'),
			states: [{ channel: b[28] + 1, rawGain: b.readUInt16LE(29), flags: b[31] }],
		}
	return null
}
function gainToRaw(db) {
	if (!Number.isFinite(db) || db < 5 || db > 60) throw Error('Analogue gain must be 5–60 dB')
	return Math.round(32768 + db * 256)
}
function values(state) {
	const analogueGain = (state.rawGain - 32768) / 256
	return {
		...state,
		analogueGain,
		gain: analogueGain - (state.flags & 1 ? 20 : 0),
		pad: !!(state.flags & 1),
		phantom: !!(state.flags & 2),
	}
}
module.exports = { poll, set, decode, gainToRaw, values }
