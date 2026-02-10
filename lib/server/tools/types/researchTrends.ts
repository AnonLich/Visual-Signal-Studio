import type { z } from "zod"
import { ResearchTrendsToolInputSchema } from "../schemas"

export type ResearchTrendsToolInput = z.infer<
	typeof ResearchTrendsToolInputSchema
>
