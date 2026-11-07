export const channels = Array.from({ length: 16 }, (_, i) => ({ id: i + 1, label: `Input ${i + 1}` }))
export const channelOption = () => ({ type: 'dropdown', id: 'channel', label: 'Input', default: 1, choices: channels })
