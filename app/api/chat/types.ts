export type StreamEvent = Record<string, unknown>

export type StreamRunner = (args: {
	send: (event: StreamEvent) => void
}) => Promise<void>
