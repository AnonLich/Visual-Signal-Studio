interface PromptSearchProps {
	value: string
	onChange: (value: string) => void
	onSubmit: () => void
	isLoading?: boolean
}

export function PromptSearch({
	value,
	onChange,
	onSubmit,
	isLoading = false,
}: PromptSearchProps) {
	return (
		<form
			className="mt-6 flex gap-2"
			onSubmit={(e) => {
				e.preventDefault()
				onSubmit()
			}}
		>
			<input
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder="Search by prompt..."
				className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
			/>
			<button
				type="submit"
				disabled={isLoading || !value.trim()}
				className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
			>
				{isLoading ? "Searching..." : "Search"}
			</button>
		</form>
	)
}
