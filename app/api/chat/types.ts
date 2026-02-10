import type { orchestrateTrendMatch } from "@/lib/server/trend-orchestrator"

export type StreamEvent = Record<string, unknown>

export type StreamRunner = (args: {
	send: (event: StreamEvent) => void
}) => Promise<void>

export type AnalyzeResultItem = {
	imageUrl: string
	strategy: Awaited<ReturnType<typeof orchestrateTrendMatch>>
}
