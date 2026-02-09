import "server-only"
import { openai } from "@ai-sdk/openai"
import { generateObject, generateText, stepCountIs } from "ai"
import { z } from "zod"
import { exaAISearchClient } from "@/lib/server/exa"
import {
	analyzeImage,
	analysisToStrategicBrief,
} from "@/lib/server/image-analysis"

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

export async function orchestrateTrendMatch(
	input: OrchestrateTrendInput,
	options?: OrchestrateTrendOptions,
): Promise<TrendStrategy> {
	const { image, mediaType, imageUrl } = input
	let stepNumber = 0

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const emitStep = (step: any) => {
		stepNumber += 1
		options?.onStep?.({ stepNumber, ...step })
	}

	// AGENT 1: The Creative Director & Researcher
	const researchResult = await generateText({
		model: openai("gpt-4o"),
		system: `
        You are a World-Class Creative Director. 
        PHASE 1: Call 'analyzeImage'. Identify the "Core Aesthetic" (e.g., 'Liminal Space', 'Office-core', 'Gorpcore').
        PHASE 2: Call 'researchTrends'. Search for niche visual signals, NOT generic topics. 
        PHASE 3: Develop 3 TikTok scripts. Each must have a 'Visual Logic' (e.g., "Static camera, high-flash, 15fps jump cuts").
        
        STRICT RULE: If you find a trend, you MUST identify the specific 'Audio Trigger' (e.g. a specific sped-up song or an ASMR sound).
        STRICT RULE: No corporate jargon like "boost engagement". Use director terms like "stop-the-scroll hook" and "visual tension".
        `,
		prompt: `Analyze this image and build a 2026 trend strategy: ${imageUrl || "Image provided in context"}`,
		stopWhen: stepCountIs(6),
		tools: {
			analyzeImage: {
				description:
					"Extract the visual DNA and market segment of the image.",
				inputSchema: z.object({}),
				execute: async () => {
					const analysis = await analyzeImage({ image, mediaType })
					return {
						analysis,
						strategicBrief: analysisToStrategicBrief(analysis),
					}
				},
			},
			researchTrends: {
				description:
					"Search Exa for high-signal cultural trends and viral formats.",
				inputSchema: z.object({ searchQuery: z.string() }),
				execute: async ({ searchQuery }) => {
					const response =
						await exaAISearchClient.chat.completions.create({
							model: "exa",
							messages: [
								{
									role: "system",
									content:
										"Find 3-5 SPECIFIC viral TikTok aesthetics or sounds for 2026. Return JSON with 'trend_name', 'visual_vibe', 'audio_or_slang', and 'source_url'. Avoid generic 'discover' pages.",
								},
								{ role: "user", content: searchQuery },
							],
							extra_body: {
								outputSchema: {
									type: "object",
									properties: {
										trends: {
											type: "array",
											items: {
												type: "object",
												properties: {
													trend_name: {
														type: "string",
													},
													visual_vibe: {
														type: "string",
														description:
															"Lighting, framing, and editing style",
													},
													audio_or_slang: {
														type: "string",
													},
													source_url: {
														type: "string",
													},
													why_its_viral: {
														type: "string",
													},
												},
												required: [
													"trend_name",
													"source_url",
													"visual_vibe",
												],
											},
										},
									},
									required: ["trends"],
								},
							},
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
						} as any)
					return JSON.parse(
						response.choices[0]?.message?.content ||
							'{"trends":[]}',
					)
				},
			},
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

	// Final formatter
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

	// --- HÄR MATAR VI IN DET I FORMATERAREN ---
	const { object } = await generateObject({
		model: openai("gpt-4o"), // Använd 4o här för "bättre smak" i scripten
		schema: TrendStrategySchema,
		system: "You are a Master Creative Strategist. Turn research into high-end, production-ready JSON. Never use corporate jargon. Be edgy and culturally relevant.",
		prompt: finalPrompt,
	})

	return object
}
