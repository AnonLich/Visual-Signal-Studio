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
STRICT RULE: For each idea's audio_spec, output a real track as 'Song Title - Artist (version/remix if relevant)'. Never output generic audio descriptions like "ethereal synth waves".
`

const FORMATTER_SYSTEM_PROMPT = `
You are a "Chaos Architect" at a guerrilla marketing agency. 
Your job is NOT to describe the image. We already have the image. 

RULES:
1. NO DESCRIPTION: Never start a sentence with "The image shows" or "This strategy mirrors".
2. CREATIVE COLLISION: You must take ONE element from the image (e.g., the text, the hat, the blue tone) and FORCE it to merge with a completely unrelated 2026 trend (e.g., 'Industrial ASMR', 'Thermal-core', 'Glitch-Western').
3. DIRECTOR STYLE: Use technical cinematography terms. No "nice lighting." Use "Tungsten 3200K," "Low-angle 14mm fisheye," "High-grain 16mm film stock."
4. THE TWIST: Every content idea must have a "Viral Anomaly"—something weird that makes people stop scrolling (e.g., 'Film this while a drone drops flower petals on a trash heap').
5. SOURCES PER IDEA: Every content idea must include sourceLinks with 1-3 links.
6. LINK DIVERSITY: Prefer different source links across the 3 ideas. If a link is reused, add at least one additional unique source link in that idea.
7. AUDIO FORMAT: audio_spec must be a specific currently trending TikTok song in the format "Song Title - Artist (version/remix if relevant)".
`

const URL_REGEX = /(https?:\/\/[^\s"'<>)]+|www\.[^\s"'<>)]+)/gi

function cleanUrlToken(value: string) {
	return value.replace(/[.,!?;:]+$/, "")
}

function normalizeExternalUrl(value: string): string | null {
	const cleaned = cleanUrlToken(value.trim())
	if (!cleaned) return null

	const candidate = /^https?:\/\//i.test(cleaned)
		? cleaned
		: `https://${cleaned}`

	try {
		const parsed = new URL(candidate)
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return null
		}
		return parsed.toString()
	} catch {
		return null
	}
}

function extractUrls(value: string): string[] {
	const matches = value.match(URL_REGEX) ?? []
	const normalized = matches
		.map((match) => normalizeExternalUrl(match))
		.filter((url): url is string => Boolean(url))
	return Array.from(new Set(normalized))
}

function ensureDiverseIdeaLinks(strategy: TrendStrategy): TrendStrategy {
	const linkPool = Array.from(
		new Map(
			(strategy.tiktokLinks ?? [])
				.map((link) => {
					const normalizedUrl = normalizeExternalUrl(link.url)
					if (!normalizedUrl) return null
					return [
						normalizedUrl,
						{
							url: normalizedUrl,
							trendContext: link.trendContext?.trim() || "Supporting source",
						},
					] as const
				})
				.filter(
					(
						item,
					): item is readonly [string, { url: string; trendContext: string }] =>
						Boolean(item),
				),
		).values(),
	)

	const usedPrimaryUrls = new Set<string>()

	const contentIdeas = strategy.contentIdeas.map((idea) => {
		const preferredLinks = (idea.sourceLinks ?? [])
			.map((link) => {
				const normalizedUrl = normalizeExternalUrl(link.url)
				if (!normalizedUrl) return null
				return {
					url: normalizedUrl,
					trendContext: link.trendContext?.trim() || "Supporting source",
				}
			})
			.filter(
				(
					item,
				): item is {
					url: string
					trendContext: string
				} => Boolean(item),
			)

		const evidenceLinks = extractUrls(idea.source_evidence ?? "").map((url) => ({
			url,
			trendContext: "Mentioned in source evidence",
		}))

		const mergedLinks = Array.from(
			new Map(
				[...preferredLinks, ...evidenceLinks].map((link) => [link.url, link]),
			).values(),
		)

		if (mergedLinks.length === 0 && linkPool.length > 0) {
			const preferredPoolLink =
				linkPool.find((link) => !usedPrimaryUrls.has(link.url)) ?? linkPool[0]
			if (preferredPoolLink) {
				mergedLinks.push(preferredPoolLink)
			}
		}

		if (mergedLinks.length > 0 && usedPrimaryUrls.has(mergedLinks[0].url)) {
			const extraUnique = linkPool.find(
				(link) =>
					!usedPrimaryUrls.has(link.url) &&
					!mergedLinks.some((existing) => existing.url === link.url),
			)
			if (extraUnique) {
				mergedLinks.push(extraUnique)
			}
		}

		const finalLinks = mergedLinks.slice(0, 3)
		if (finalLinks[0]) {
			usedPrimaryUrls.add(finalLinks[0].url)
		}

		return {
			...idea,
			sourceLinks: finalLinks,
		}
	})

	return { ...strategy, contentIdeas }
}

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
