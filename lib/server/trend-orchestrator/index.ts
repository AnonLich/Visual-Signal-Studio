import "server-only"
import { openai } from "@ai-sdk/openai"
import { generateObject, generateText, stepCountIs, embed } from "ai"
import { createAnalyzeImageTool, createResearchTrendsTool } from "../tools"
import { TrendStrategySchema } from "./schemas"
import {
	FORMATTER_SYSTEM_PROMPT,
	REFINER_SYSTEM_PROMPT,
	RESEARCH_SYSTEM_PROMPT,
} from "./prompts"
import {
	buildFallbackResearchQueries,
	ensureDiverseIdeaLinks,
} from "./strategy-helpers"
import type {
	EmittedTrendStep,
	OrchestrateTrendInput,
	OrchestrateTrendOptions,
	RefineTrendInput,
	TrendStrategy,
} from "./types"
import {
	analyzeImage,
	analysisToStrategicBrief,
	embedImageAnalysis,
	ImageAnalysis,
} from "../image-analysis"
import { cosineSimilarity } from "@/lib/cosine-similarity"
export { TrendStrategySchema } from "./schemas"
export type { TrendOrchestrationStep, TrendStrategy } from "./types"

export async function refineTrendStrategy(
	input: RefineTrendInput,
): Promise<TrendStrategy> {
	const { feedback, currentStrategy, imageUrl } = input

	const result = await generateObject({
		model: openai.chat("gpt-4o-mini"),
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

	return ensureDiverseIdeaLinks(result.object)
}

export async function orchestrateTrendMatch(
	input: OrchestrateTrendInput,
	options?: OrchestrateTrendOptions,
): Promise<TrendStrategy> {
	const { image, mediaType, imageUrl } = input
	const researchTool = createResearchTrendsTool()
	let stepNumber = 0

	const emitStep = (step: EmittedTrendStep) => {
		stepNumber += 1
		options?.onStep?.({ stepNumber, ...step })
	}

	const researchResult = await generateText({
		model: openai.chat("gpt-4o"),
		system: RESEARCH_SYSTEM_PROMPT,
		prompt: "Analyze the image provided in context and build a 2026 trend strategy.",
		stopWhen: stepCountIs(6),
		tools: {
			analyzeImage: createAnalyzeImageTool({ image, mediaType }),
			researchTrends: researchTool,
		},
		onStepFinish: (step) =>
			emitStep({
				text: step.text,
				toolCalls: step.toolCalls,
				toolResults: step.toolResults,
			}),
	})

	// 2. EXTRACTION
	const analysisStep = researchResult.steps
		.flatMap((s) => s.toolResults)
		.find((tr) => tr.toolName === "analyzeImage")

	const analysisOutput = analysisStep?.output as
		| { analysis?: ImageAnalysis }
		| undefined
	const analysisFromTool = analysisOutput?.analysis
	const analysis =
		analysisFromTool ?? (await analyzeImage({ image, mediaType }))

	let rawTrendTexts = researchResult.steps
		.flatMap((step) => step.toolResults)
		.filter((tr) => tr.toolName === "researchTrends")
		.map((tr) => {
			const output = tr.output
			if (typeof output === "string") {
				return output
			}

			try {
				return JSON.stringify(output)
			} catch {
				return String(output)
			}
		})
		.map((text) => text.trim())
		.filter((text) => text.length > 0)

	let freshTrendCount = researchResult.steps
		.flatMap((step) => step.toolResults)
		.filter((tr) => tr.toolName === "researchTrends")
		.reduce((count, tr) => {
			const output = tr.output as { trends?: unknown[] } | undefined
			const trends = Array.isArray(output?.trends) ? output.trends : []
			return count + trends.length
		}, 0)

	if (freshTrendCount === 0) {
		emitStep({
			text: "No fresh trends from the initial query. Running expanded fallback searches.",
			toolCalls: [],
			toolResults: [],
		})

		const fallbackQueries = buildFallbackResearchQueries(analysis)
		const fallbackResults = await Promise.allSettled(
			fallbackQueries.map((query) => researchTool.execute({ searchQuery: query })),
		)

		const successfulFallbacks = fallbackResults.flatMap((result) =>
			result.status === "fulfilled"
				? [result.value as { trends?: unknown[] }]
				: [],
		)

		const fallbackTexts = successfulFallbacks
			.map((output) => JSON.stringify(output))
			.map((text) => text.trim())
			.filter((text) => text.length > 0)

		rawTrendTexts = [...rawTrendTexts, ...fallbackTexts]
		freshTrendCount += successfulFallbacks.reduce((count, output) => {
			const trends = Array.isArray(output?.trends) ? output.trends : []
			return count + trends.length
		}, 0)
	}

	if (freshTrendCount === 0) {
		throw new Error(
			"No trend sources from the last 12 months were found after expanded search. Try another image or add feedback with a niche trend direction.",
		)
	}

	// 3. SEMANTIC RE-RANKING
	const imageVector = await embedImageAnalysis(analysis)

	const rankedResults = await Promise.all(
		rawTrendTexts.map(async (text) => {
			const { embedding } = await embed({
				model: openai.embedding("text-embedding-3-small"),
				value: text,
			})
			const score = cosineSimilarity(imageVector, embedding)
			return { text, score }
		}),
	)

	console.log(rankedResults)

	const topMatches = rankedResults
		.sort((a, b) => b.score - a.score)
		.slice(0, 5)
		.map((r) => r.text)

	// 4. SYNTHESIS PHASE (Final Structured Output)
	const finalPrompt = `
SYSTEM OVERRIDE: STOP DESCRIBING THE IMAGE. 

TASK: Use the provided IMAGE DNA as a "Victim" for a 2026 Creative Hijack.

IMAGE DNA: 
${analysisToStrategicBrief(analysis)}

2026 TREND SIGNALS (RAW DATA):
${JSON.stringify(topMatches)}

CONSTRAINT:
- Use only sources and trend signals from the last 12 months.

REQUIRED OUTPUT:
1. STRATEGY NAME: Must be a 2-word cryptic title (e.g., 'STATIC-MOSS', 'BLUEPRINT-VOID').
2. THE MANIFESTO: 2 sentences max. No corporate jargon. Be edgy.
3. 3 CONTENT PILLARS (The "Mutants"):
   - COLUMN A: Take a visual piece from the image.
   - COLUMN B: Take a weird trend from the research.
   - THE RESULT: A TikTok script that is a 'Pattern Interrupt'.

4. PRODUCTION SPEC:
   - AUDIO: Use a specific currently trending TikTok song in this exact format: 'Song Title - Artist (version/remix if relevant)'.
   - VISUAL: Describe the lens, the movement, and the "Chaos Factor".
`

	const { object } = await generateObject({
		model: openai.chat("gpt-4o"),
		schema: TrendStrategySchema,
		system: FORMATTER_SYSTEM_PROMPT,
		prompt: finalPrompt,
	})

	return ensureDiverseIdeaLinks(object)
}
