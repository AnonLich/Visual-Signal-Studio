import { z } from "zod"
import { TrendStrategySchema } from "@/lib/server/trend-orchestrator"

export const AnalyzeRequestSchema = z.object({
	prompt: z.string().optional(),
	image: z.object({
		data: z.string().min(1),
		mediaType: z.string().min(1),
		imageUrl: z.string().url().optional(),
	}),
})

export const RefineRequestSchema = z.object({
	mode: z.literal("refine"),
	feedback: z.string().min(1),
	currentStrategy: TrendStrategySchema,
	imageUrl: z.string().url().optional(),
})
