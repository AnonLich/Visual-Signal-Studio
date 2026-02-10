import { openai } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { TrendStrategySchema } from "../trend-orchestrator/schemas"
import type { RefineTrendInput } from "../trend-orchestrator/types"
import { RefineTrendStrategyToolInputSchema } from "./schemas"

const REFINER_SYSTEM_PROMPT =
	"Refine the strategy based on user feedback. Keep evidence-backed ideas and at least one TikTok link."

export function createRefineTrendStrategyTool(input: RefineTrendInput) {
	const { feedback, currentStrategy, imageUrl } = input

	return {
		description:
			"Refine an existing trend strategy using user feedback while preserving evidence-backed ideas.",
		inputSchema: RefineTrendStrategyToolInputSchema,
		execute: async () => {
			const result = await generateObject({
				model: openai("gpt-4o-mini"),
				schema: TrendStrategySchema,
				system: REFINER_SYSTEM_PROMPT,
				prompt: `
CURRENT_STRATEGY:
${JSON.stringify(currentStrategy)}

USER_FEEDBACK:
${feedback}

REFERENCE_IMAGE_URL:
${imageUrl ?? "n/a"}
`,
			})

			if (!result.object.tiktokLinks || result.object.tiktokLinks.length === 0) {
				result.object.tiktokLinks = currentStrategy.tiktokLinks
			}

			return result.object
		},
	}
}
