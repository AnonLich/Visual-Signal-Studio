import "server-only"
import { openai } from "@ai-sdk/openai"
import { generateObject, generateText, stepCountIs, embed } from "ai"
import { createAnalyzeImageTool, createResearchTrendsTool } from "../tools"
import { TrendStrategySchema } from "./schemas"
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

const FORMATTER_SYSTEM_PROMPT = `
You are a "Chaos Architect" at a guerrilla marketing agency. 
Your job is NOT to describe the image. We already have the image. 

RULES:
1. NO DESCRIPTION: Never start a sentence with "The image shows" or "This strategy mirrors".
2. CREATIVE COLLISION: You must take ONE element from the image (e.g., the text, the hat, the blue tone) and FORCE it to merge with a completely unrelated 2026 trend (e.g., 'Industrial ASMR', 'Thermal-core', 'Glitch-Western').
3. DIRECTOR STYLE: Use technical cinematography terms. No "nice lighting." Use "Tungsten 3200K," "Low-angle 14mm fisheye," "High-grain 16mm film stock."
4. THE TWIST: Every content idea must have a "Viral Anomaly"—something weird that makes people stop scrolling (e.g., 'Film this while a drone drops flower petals on a trash heap').
`

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
		model: openai.chat("gpt-4o"),
		system: RESEARCH_SYSTEM_PROMPT,
		prompt: "Analyze the image provided in context and build a 2026 trend strategy.",
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

	// 2. EXTRACTION
	const analysisStep = researchResult.steps
		.flatMap((s) => s.toolResults)
		.find((tr) => tr.toolName === "analyzeImage")

	const analysisFromTool = analysisStep?.output?.analysis as
		| ImageAnalysis
		| undefined
	const analysis =
		analysisFromTool ?? (await analyzeImage({ image, mediaType }))

	const rawTrendTexts = researchResult.steps
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

REQUIRED OUTPUT:
1. STRATEGY NAME: Must be a 2-word cryptic title (e.g., 'STATIC-MOSS', 'BLUEPRINT-VOID').
2. THE MANIFESTO: 2 sentences max. No corporate jargon. Be edgy.
3. 3 CONTENT PILLARS (The "Mutants"):
   - COLUMN A: Take a visual piece from the image.
   - COLUMN B: Take a weird trend from the research.
   - THE RESULT: A TikTok script that is a 'Pattern Interrupt'.

4. PRODUCTION SPEC:
   - AUDIO: Be hyper-specific (e.g., 'Slowed + Reverb Swedish trap mixed with industrial printer noises').
   - VISUAL: Describe the lens, the movement, and the "Chaos Factor".
`

	const { object } = await generateObject({
		model: openai.chat("gpt-4o"),
		schema: TrendStrategySchema,
		system: FORMATTER_SYSTEM_PROMPT,
		prompt: finalPrompt,
	})

	return object
}
