import type { z } from "zod"
import {
	PromptSearchBodySchema,
	SearchImagesToolInputSchema,
} from "./schemas"

export type PromptSearchBody = z.infer<typeof PromptSearchBodySchema>
export type SearchImagesToolInput = z.infer<typeof SearchImagesToolInputSchema>
