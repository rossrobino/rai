const elements = document.querySelectorAll<HTMLElement>(
	"[data-valuation-history]",
);

if (elements.length > 0) {
	void import("./chart").then(({ render }) => {
		for (const element of elements) render(element);
	});
}
