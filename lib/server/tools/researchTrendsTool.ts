import { z } from "zod"
import { exaAISearchClient } from "../exa"

export function createResearchTrendsTool() {
	return {
		description:
			"Search Exa for high-signal cultural trends and viral formats.",
		inputSchema: z.object({ searchQuery: z.string() }),
		execute: async ({ searchQuery }: { searchQuery: string }) => {
			const response = await exaAISearchClient.chat.completions.create({
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
				response.choices[0]?.message?.content || '{"trends":[]}',
			)
		},
	}
}
