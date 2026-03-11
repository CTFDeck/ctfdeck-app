import { DomSanitizer, SafeHtml, SecurityContext } from '@angular/platform-browser';
import AnsiToHtml from 'ansi-to-html';

export function createAnsiConverter(): AnsiToHtml {
  return new AnsiToHtml({
    fg: '#d4d4d4',
    bg: '#1e1e1e',
    newline: true,
    colors: {
      4: '#61afef',
      34: '#61afef',
    },
  });
}

export function toSafeHtml(
  sanitizer: DomSanitizer,
  content: string,
): SafeHtml {
  return sanitizer.bypassSecurityTrustHtml(content);
}

export function ansiToSafeHtml(
  converter: AnsiToHtml,
  sanitizer: DomSanitizer,
  content: string,
): SafeHtml {
  const html = converter.toHtml(content);
  return sanitizer.bypassSecurityTrustHtml(html);
}

export function appendErrorToLastOutput(
  outputLines: SafeHtml[],
  sanitizer: DomSanitizer,
  data: string,
): SafeHtml[] {
  if (outputLines.length === 0) {
    return [
      sanitizer.bypassSecurityTrustHtml(`<span class="text-red-500">${data}</span>`),
    ];
  }

  const updated = [...outputLines];
  const lastLine = updated[updated.length - 1];
  const currentContent = sanitizer.sanitize(SecurityContext.HTML, lastLine) || '';
  const newContent = currentContent + data;

  updated[updated.length - 1] = sanitizer.bypassSecurityTrustHtml(
    `<span class="text-red-500">${newContent}</span>`,
  );

  return updated;
}

export function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
