import { z } from "zod"

export const PromptSearchBodySchema = z.object({
	messages: z.array(z.any()).min(1),
})

export const SearchImagesToolInputSchema = z.object({
	prompt: z.string().min(1),
	limit: z.number().int().positive().max(20).default(5),
})
