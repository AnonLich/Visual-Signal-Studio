import "server-only"
import { openai } from "@ai-sdk/openai"
import { generateObject, generateText, stepCountIs } from "ai"
import { createAnalyzeImageTool, createResearchTrendsTool } from "../tools"
import { TrendStrategySchema } from "./schemas"
import type {
	EmittedTrendStep,
	OrchestrateTrendInput,
	OrchestrateTrendOptions,
	RefineTrendInput,
	TrendStrategy,
} from "./types"
export { TrendStrategySchema } from "./schemas"
export type { TrendOrchestrationStep, TrendStrategy } from "./types"

const REFINER_SYSTEM_PROMPT =
	"Refine the strategy based on user feedback. Keep evidence-backed ideas and at least one TikTok link."

const RESEARCH_SYSTEM_PROMPT = `
You are a World-Class Creative Director.
PHASE 1: Call 'analyzeImage'. Identify the "Core Aesthetic" (e.g., 'Liminal Space', 'Office-core', 'Gorpcore').
PHASE 2: Call 'researchTrends'. Search for niche visual signals, NOT generic topics.
PHASE 3: Develop 3 TikTok scripts. Each must have a 'Visual Logic' (e.g., "Static camera, high-flash, 15fps jump cuts").

STRICT RULE: If you find a trend, you MUST identify the specific 'Audio Trigger' (e.g. a specific sped-up song or an ASMR sound).
STRICT RULE: No corporate jargon like "boost engagement". Use director terms like "stop-the-scroll hook" and "visual tension".
`

const FORMATTER_SYSTEM_PROMPT =
	"You are a Master Creative Strategist. Turn research into high-end, production-ready JSON. Never use corporate jargon. Be edgy and culturally relevant."

export async function refineTrendStrategy(
	input: RefineTrendInput,
): Promise<TrendStrategy> {
	const { feedback, currentStrategy, imageUrl } = input

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

	// ensure at least one link
	if (!result.object.tiktokLinks || result.object.tiktokLinks.length === 0) {
		result.object.tiktokLinks = currentStrategy.tiktokLinks
	}

	return result.object
}

export async function orchestrateTrendMatch(
	input: OrchestrateTrendInput,
	options?: OrchestrateTrendOptions,
): Promise<TrendStrategy> {
	const { image, mediaType, imageUrl } = input
	let stepNumber = 0

	const emitStep = (step: EmittedTrendStep) => {
		stepNumber += 1
		options?.onStep?.({ stepNumber, ...step })
	}

	const researchResult = await generateText({
		model: openai("gpt-4o"),
		system: RESEARCH_SYSTEM_PROMPT,
		prompt: `Analyze the image provided in context and build a 2026 trend strategy
		}`,
		stopWhen: stepCountIs(6),
		tools: {
			analyzeImage: createAnalyzeImageTool({ image, mediaType }),
			researchTrends: createResearchTrendsTool(),
		},
		onStepFinish: (step) =>
			emitStep({
				text: step.text,
				toolCalls: step.toolCalls,
				toolResults: step.toolResults,
			}),
	})

	const rawTrendData = researchResult.steps
		.flatMap((step) => step.toolResults)
		.filter((tr) => tr.toolName === "researchTrends")
		.map((tr) => tr.output)

	console.log(JSON.stringify(rawTrendData))

	const finalPrompt = `
FINAL TASK: Combine the Creative Discussion with the Real TikTok evidence.

RESEARCH LOG:
${researchResult.text}

RAW TREND DATA FROM EXA:
${JSON.stringify(rawTrendData)}

INSTRUCTION:
1. The 'strategicBrief' must be a high-level creative direction (e.g., "The 'Uncanny Bakery' Strategy").
2. Each 'tiktok_script' must be professional:
   - Hook: Must be a specific visual or auditory pattern.
   - Visual Direction: Describe camera movement, lighting (e.g. 'harsh flash', 'handheld jitter'), and pace.
   - Audio Spec: Name a specific sound or style (e.g. 'sped-up synth pop' or 'heavy bass ASMR').
3. 'cultural_context': Explain WHY this works for the brand DNA and the current 2026 internet mood.
`

	const { object } = await generateObject({
		model: openai("gpt-4o"),
		schema: TrendStrategySchema,
		system: FORMATTER_SYSTEM_PROMPT,
		prompt: finalPrompt,
	})

	return object
}
