import "server-only"
import { openai } from "@ai-sdk/openai"
import { generateText, generateObject, stepCountIs } from "ai"
import { z } from "zod"
import { researchTrends as researchTrendsWithExa } from "@/lib/server/exa"
import {
	analyzeImage,
	analysisToStrategicBrief,
} from "@/lib/server/image-analysis"

// --- SCHEMAS ---

const ContentIdeaSchema = z.object({
	title: z.string(),
	concept: z.string(),
	// Ta bort .url() och använd beskrivning istället för att undvika valideringsfelet
	sourceUrl: z
		.string()
		.describe(
			"The exact URL from the Exa results that validates this trend.",
		),
	trendingSignal: z
		.string()
		.describe(
			"Specific viral sound, meme, or slang found in the search text.",
		),
	visualReference: z
		.string()
		.describe(
			"Copy the SPECIFIC camera work or lighting from the sourceUrl (e.g. 'Lo-fi handycam', 'High-flash photography', 'Gritty 90s editorial style')",
		),
	whyNow: z.string(),
})

export const TrendStrategySchema = z.object({
	strategicBrief: z.string(),
	contentIdeas: z.array(ContentIdeaSchema).length(3),
	reasoning: z.string(),
})

export type TrendStrategy = z.infer<typeof TrendStrategySchema>

// --- TYPES ---

type OrchestrateTrendInput = {
	image: string
	mediaType: string
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

// --- ORCHESTRATOR ---

export async function orchestrateTrendMatch(
	input: OrchestrateTrendInput,
	options?: OrchestrateTrendOptions,
): Promise<TrendStrategy> {
	const { image, mediaType, imageUrl } = input
	let stepNumber = 0

	// STEG 1: Den Agentiska loopen (Research & Reasoning)
	const researchResult = await generateText({
		model: openai("gpt-4o"),
		system: `
You are a High-End Creative Agency Swarm. 
STRICT RULE: Every content idea MUST be based on a real result from the 'researchTrends' tool.
STRICT RULE: Do not use generic hashtags. Use specific viral audio names or niche aesthetics found in the search text.

WORKFLOW:
1. 'analyzeImage' -> Get the Brand DNA.
2. 'researchTrends' -> Find REAL internet culture signals. 
3. 'validateMatch' -> The Critic must approve. If the Analyst suggests something generic (like "Freshness"), the Critic MUST reject it and demand a new search for something culturally edgy.
`,
		prompt: `Create a trend-matched content strategy for the uploaded image. Reference URL: ${imageUrl}`,
		stopWhen: stepCountIs(8),
		tools: {
			analyzeImage: {
				description: "Analyze visual style and brand archetype.",
				inputSchema: z.object({}),
				execute: async () => {
					const analysis = await analyzeImage({ image, mediaType })
					const strategicBrief = analysisToStrategicBrief(analysis)
					return { analysis, strategicBrief }
				},
			},
			researchTrends: {
				description:
					"Search for SPECIFIC viral signals and aesthetics.",
				inputSchema: z.object({
					query: z
						.string()
						.describe(
							"E.g. 'TikTok trends for retail staff' or 'POV supermarket humor'",
						),
				}),
				execute: async ({ query }) => {
					// Vi rensar queryn och tvingar sociala medier-fokus i lib/server/exa
					return await researchTrendsWithExa(query)
				},
			},
			validateMatch: {
				description: "The Critic's review of a proposed trend match.",
				inputSchema: z.object({
					trendName: z.string(),
					reasoning: z.string(),
				}),
				execute: async ({ trendName, reasoning }) => {
					console.log(`Critiquing: ${trendName}`)
					const isGeneric = [
						"fresh",
						"service",
						"quality",
						"customer",
					].some((word) => trendName.toLowerCase().includes(word))
					if (isGeneric) {
						return {
							status: "REJECTED",
							message:
								"Too corporate. Find a specific TikTok format, meme or niche 'core' aesthetic.",
						}
					}
					return {
						status: "APPROVED",
						message: "Culturally relevant.",
					}
				},
			},
		},
		onStepFinish: (step) => {
			stepNumber += 1
			options?.onStep?.({
				stepNumber,
				text: step.text,
				reasoningText: step.reasoningText,
				toolCalls: step.toolCalls.map((tc) => ({
					toolName: tc.toolName,
					input: tc.input,
				})),
				toolResults: step.toolResults.map((tr) => ({
					toolName: tr.toolName,
					output: tr.output,
				})),
			})
		},
	})

	// STEG 2: Extraction Phase (Hårdkoppling till data)
	// Vi extraherar alla tool results för att mata formateraren med RÅDATA
	const rawToolData = researchResult.steps
		.flatMap((s) => s.toolResults)
		.filter((tr) => tr.toolName === "researchTrends")
		.map((tr) => tr.output)

	const { object } = await generateObject({
		model: openai("gpt-4o-mini"),
		schema: TrendStrategySchema,
		system: `
        You are a Data Formatter. 
        Your job is to take the Creative Discussion and the RAW Search Data and format it into the final JSON.
        
        RULES:
        1. If a 'Content Idea' doesn't have a corresponding URL in the RAW Search Data, you MUST ignore it.
        2. Ensure the 'strategicBrief' matches the 'analyzeImage' result from the log.
        3. Use the exact 'trendingSignal' (audio/meme) found in the search highlights.
        `,
		prompt: `
            CREATIVE DISCUSSION: 
            ${researchResult.text}

            RAW SEARCH DATA FROM EXA: 
            ${JSON.stringify(rawToolData)}
        `,
	})

	return object
}
