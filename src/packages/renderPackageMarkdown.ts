import { marked } from "marked";

const README_MAX_CHARS = 20_000;

marked.setOptions({
	gfm: true,
	breaks: false,
});

/** Render package readme markdown to sanitized HTML for the registry webview. */
export function renderPackageMarkdown(source: string): string {
	const trimmed = source.trim();
	if (!trimmed) {
		return "";
	}
	const html = marked.parse(trimmed.slice(0, README_MAX_CHARS), {
		async: false,
	}) as string;
	return sanitizeMarkdownHtml(html);
}

function sanitizeMarkdownHtml(html: string): string {
	return html
		.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
		.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
		.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
		.replace(/javascript:/gi, "")
		.replace(/<(iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
		.replace(/<(iframe|object|embed|form)\b[^>]*\/?>/gi, "");
}
