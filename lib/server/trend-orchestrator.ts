import "server-only"
import { openai } from "@ai-sdk/openai"
import { generateObject, generateText, stepCountIs } from "ai"
import { z } from "zod"
import { createAnalyzeImageTool, createResearchTrendsTool } from "./tools"

const ContentIdeaSchema = z.object({
	title: z.string(),
	tiktok_script: z.object({
		hook: z.string().describe("The first 1.5 seconds that stop the scroll"),
		visual_direction: z
			.string()
			.describe(
				"Camera angle, lighting type (e.g. high-contrast), and editing pace",
			),
		audio_spec: z
			.string()
			.describe("The specific viral sound or ASMR trigger to use"),
	}),
	source_evidence: z.string(),
	cultural_context: z
		.string()
		.describe("Why does this specific sub-culture care about this?"),
})

const TikTokLinkSchema = z.object({
	url: z.string(),
	trendContext: z.string(),
})

export const TrendStrategySchema = z.object({
	strategicBrief: z.string(),
	contentIdeas: z.array(ContentIdeaSchema).length(3),
	tiktokLinks: z.array(TikTokLinkSchema).min(1),
	reasoning: z.string(),
})

export type TrendStrategy = z.infer<typeof TrendStrategySchema>

type OrchestrateTrendInput = {
	image: string
	mediaType: string
	imageUrl?: string
}

type RefineTrendInput = {
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

type OrchestrateTrendOptions = {
	onStep?: (step: TrendOrchestrationStep) => void
}

type EmittedTrendStep = Omit<TrendOrchestrationStep, "stepNumber">

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
		prompt: `Analyze this image and build a 2026 trend strategy: ${
			imageUrl ?? "Image provided in context"
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
