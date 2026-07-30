import { Schema } from "ovr";

export const ProviderSchema = Schema.object({
	id: Schema.literal("polymarket"),
	name: Schema.string().min(1),
	status: Schema.enum(["active", "permission-required"]),
	description: Schema.string().min(1),
	website: Schema.string().url(),
	docs: Schema.string().url(),
	terms: Schema.string().url(),
	brand: Schema.string().url().optional(),
	asset: Schema.literal("official").optional(),
	notice: Schema.string().min(1),
	methods: Schema.array(Schema.string().min(1)),
});

const result = Schema.array(ProviderSchema).parse([
	{
		id: "polymarket",
		name: "Polymarket",
		status: "active",
		description:
			"Public prediction-market event and quote data used by the active IPO and valuation-threshold methods.",
		website: "https://polymarket.com",
		docs: "https://docs.polymarket.com/api-reference/introduction",
		terms: "https://polymarket.com/tos",
		brand: "https://polymarket.com/brand",
		asset: "official",
		notice:
			"The displayed icon is an unmodified official brand asset. Rai is independent and is not affiliated with or endorsed by Polymarket.",
		methods: [
			"current-valuation-ensemble",
			"prediction-market-ipo",
			"prediction-market-valuation-thresholds",
		],
	},
]);

if (result.issues) {
	throw new Error(`Invalid provider catalog: ${result.issues.join("; ")}`);
}

export const providers = result.data;

export function getMethodProviders(method: string) {
	return providers.filter((provider) => provider.methods.includes(method));
}

export function getProvider(id: string) {
	return providers.find((provider) => provider.id === id);
}
