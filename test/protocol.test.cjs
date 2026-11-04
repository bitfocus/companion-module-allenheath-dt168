const { test } = require('node:test')
const assert = require('node:assert/strict')
const p = require('../src/protocol')
const id = Buffer.from('0200000000010000', 'hex')
const full =
	'ffff004c007800000200000000020000416c6c656e487468010300005599010099000099000099000099000099006c99002b9900449900449900449900449900449900449900449900449900'
test('decode real full-state response and pad without losing gain precision', () => {
	const d = p.decode(Buffer.from(full, 'hex'))
	assert.equal(d.states.length, 16)
	assert.equal(d.deviceId, '0200000000020000')
	assert.equal(d.states[0].rawGain, 0x9955)
	assert.equal(d.states[0].flags, 1)
	assert.equal(p.values(d.states[0]).gain, 5.33203125)
	assert.equal(d.states[15].rawGain, 0x9944)
})
test('encode byte-for-byte captured pad command', () => {
	assert.equal(
		p.set(id, 0x2d, 1, { rawGain: 0x9955, flags: 1 }).toString('hex'),
		'ffff0028002d00000200000000010000416c6c656e48746801010000005599010000000000000000',
	)
})
test('decode real incremental status', () => {
	const s = p.decode(
		Buffer.from('ffff0028007700000200000000020000416c6c656e48746801010000005599010000000000000000', 'hex'),
	)
	assert.deepEqual(s.states, [{ channel: 1, rawGain: 0x9955, flags: 1 }])
})
test('gain conversion matches device-confirmed 20 and 21 dB, rejects out-of-range gain', () => {
	assert.equal(p.gainToRaw(20), 37888)
	assert.equal(p.gainToRaw(21), 38144)
	for (const g of [NaN, Infinity, 4, 61]) assert.throws(() => p.gainToRaw(g))
})
test('reject truncated, foreign and malformed status packets', () => {
	const b = Buffer.from(full, 'hex')
	assert.equal(p.decode(b.subarray(0, 60)), null)
	const foreign = Buffer.from(b)
	foreign[16] = 0
	assert.equal(p.decode(foreign), null)
	const bad = Buffer.from(b)
	bad[26] = 1
	assert.equal(p.decode(bad), null)
	assert.throws(() => p.set(id, 1, 17, { rawGain: 37888, flags: 0 }))
	assert.throws(() => p.set(id, 1, 1, { rawGain: 37888, flags: 256 }))
})
test('all sixteen channel encodings preserve gain and combined flags', () => {
	for (let ch = 1; ch <= 16; ch++) {
		const packet = p.set(id, 1, ch, { rawGain: 38144, flags: 3 })
		const state = p.decode(packet).states[0]
		assert.equal(state.channel, ch)
		assert.equal(state.rawGain, 38144)
		assert.equal(state.flags, 3)
	}
})
test('Companion 5 entrypoint works with the real base library and complete host context', async () => {
	const { default: Instance, UpgradeScripts } = require('../src/main')
	assert.equal(UpgradeScripts.length, 0)
	const captured = {}
	const context = {
		_isInstanceContext: true,
		id: 'test',
		label: 'MyDT',
		upgradeScripts: [],
		setActionDefinitions: (v) => {
			captured.actions = v
		},
		setFeedbackDefinitions: (v) => {
			captured.feedbacks = v
		},
		setVariableDefinitions: (v) => {
			captured.variables = v
		},
		setPresetDefinitions: (structure, presets) => {
			captured.structure = structure
			captured.presets = presets
		},
		setVariableValues: (v) => {
			captured.values = v
		},
		checkAllFeedbacks: () => {},
		updateStatus: () => {},
	}
	const inst = new Instance(context)
	inst.define()
	assert.equal(Object.keys(captured.actions).length, 5)
	assert.equal(Object.keys(captured.presets).length, 64)
	assert.equal(Object.keys(captured.variables).length, 66)
	assert.equal(captured.structure.length, 16)
	assert.equal(Object.keys(captured.feedbacks).length, 3)
	assert.equal(captured.presets.input_1_up.type, 'simple')
	assert.ok(captured.presets.input_1_up.style.text.includes('$(MyDT:input_1_gain)'))
	assert.ok(!Array.isArray(captured.variables))
	for (const section of captured.structure) for (const id of section.definitions) assert.ok(captured.presets[id])
	let wanted
	inst.act = async (ch, mutate) => {
		assert.equal(ch, 16)
		wanted = mutate({ rawGain: 38144, flags: 3 })
	}
	await captured.actions.pad.callback({ options: { channel: 16, mode: 'off' } })
	assert.equal(wanted.flags, 2)
	assert.equal(wanted.rawGain, 38144)
	await captured.actions.phantom.callback({ options: { channel: 16, mode: 'off' } })
	assert.equal(wanted.flags, 1)
	assert.equal(wanted.rawGain, 38144)
	for (const preset of Object.values(captured.presets))
		for (const action of preset.steps[0].down) assert.ok(captured.actions[action.actionId])
	inst.online = false
	inst.publish()
	assert.equal(captured.values.connected, 0)
	assert.ok(inst.getConfigFields().every((f) => Number.isFinite(f.width)))
})
