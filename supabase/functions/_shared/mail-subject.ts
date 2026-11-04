/** RFC 2047 encoded words, kept on a single header line. Avoid MIME soft line breaks in headers. */
export function mailSubject(subject: string): string {
  const clean = subject.replace(/[\r\n]/g, ' ');
  const chunks: string[] = [];
  let current = '';
  for (const char of clean) {
    if (new TextEncoder().encode(current + char).length > 42) {
      chunks.push(current); current = '';
    }
    current += char;
  }
  if (current) chunks.push(current);
  return chunks.map(chunk => {
    const bytes = new TextEncoder().encode(chunk);
    return `=?UTF-8?B?${btoa(String.fromCharCode(...bytes))}?=`;
  }).join(' ');
}