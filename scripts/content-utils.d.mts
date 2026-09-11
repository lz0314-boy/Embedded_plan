export function markdownToHtml(markdown: string): string;
export function parseFrontmatter(source: string, file: string): { metadata: Record<string, unknown>; body: string };
