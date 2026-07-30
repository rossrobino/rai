import type { Result } from "@robino/md";
import { MethodSchema } from "@/server/method-schema";

const modules = import.meta.glob<Result<typeof MethodSchema>>(
	"../content/methods/*.md",
	{ eager: true },
);

export const methods = Object.entries(modules)
	.map(([path, content]) => ({
		name: path.slice(path.lastIndexOf("/") + 1, -3),
		content,
	}))
	.sort((a, b) => a.content.frontmatter.order - b.content.frontmatter.order);

export function getMethod(name: string) {
	return methods.find((method) => method.name === name);
}
