import type { z } from "zod"
import { TrendStrategySchema } from "../schemas"

export type TrendStrategy = z.infer<typeof TrendStrategySchema>

export type OrchestrateTrendInput = {
	image: string
	mediaType: string
	imageUrl?: string
	feedback?: string
	currentStrategy?: TrendStrategy
}

export type RefineTrendInput = {
	feedback: string
	currentStrategy: TrendStrategy
	imageUrl?: string
}

export type TrendOrchestrationStep = {
	stepNumber: number
	text?: string
	reasoningText?: string
	toolCalls: Array<{ toolName: string; input: unknown }>
	toolResults: Array<{ toolName: string; output: unknown }>
}

export type OrchestrateTrendOptions = {
	onStep?: (step: TrendOrchestrationStep) => void
}

export type EmittedTrendStep = Omit<TrendOrchestrationStep, "stepNumber">
