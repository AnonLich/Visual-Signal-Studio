import { analysisToStrategicBrief, analyzeImage } from "../image-analysis"
import { AnalyzeImageToolInputSchema } from "./schemas"
import type { AnalyzeImageToolParams } from "./types"

export function createAnalyzeImageTool({
	image,
	mediaType,
}: AnalyzeImageToolParams) {
	return {
		description: "Extract the visual DNA and market segment of the image.",
		inputSchema: AnalyzeImageToolInputSchema,
		execute: async () => {
			const analysis = await analyzeImage({ image, mediaType })
			return {
				analysis,
				strategicBrief: analysisToStrategicBrief(analysis),
			}
		},
	}
}
