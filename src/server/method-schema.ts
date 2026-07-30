import { Schema } from "ovr";

export const MethodSchema = Schema.object({
	title: Schema.string().min(1),
	description: Schema.string().min(1),
	summary: Schema.string().min(1),
	eyebrow: Schema.string().min(1),
	status: Schema.string().min(1),
	order: Schema.number().int().min(1),
	updated: Schema.string().min(1),
	readTime: Schema.string().min(1),
});
