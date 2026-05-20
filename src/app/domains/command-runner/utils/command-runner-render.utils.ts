import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SecurityContext } from '@angular/core';
import AnsiToHtml from 'ansi-to-html';

export function createAnsiConverter(): AnsiToHtml {
  return new AnsiToHtml({
    fg: '#d4d4d4',
    bg: '#1e1e1e',
    newline: false,
    colors: {
      4: '#61afef',
      34: '#61afef',
    },
  });
}

export function toSafeHtml(sanitizer: DomSanitizer, content: string): SafeHtml {
  return sanitizer.bypassSecurityTrustHtml(content);
}

export function ansiToSafeHtml(
  converter: AnsiToHtml,
  sanitizer: DomSanitizer,
  content: string,
): SafeHtml {
  const html = converter.toHtml(normalizeTerminalOutput(content));
  return sanitizer.bypassSecurityTrustHtml(html);
}

export function normalizeTerminalOutput(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\r(?!\n)/g, '\n')
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, '');
}

export function appendErrorToLastOutput(
  outputLines: SafeHtml[],
  sanitizer: DomSanitizer,
  data: string,
): SafeHtml[] {
  if (outputLines.length === 0) {
    return [sanitizer.bypassSecurityTrustHtml(`<span class="text-red-500">${data}</span>`)];
  }

  const updated = [...outputLines];
  const lastLine = updated[updated.length - 1];
  const currentContent = sanitizer.sanitize(SecurityContext.HTML, lastLine) || '';
  const newContent = currentContent + normalizeTerminalOutput(data);

  updated[updated.length - 1] = sanitizer.bypassSecurityTrustHtml(
    `<span class="text-red-500">${newContent}</span>`,
  );

  return updated;
}

export function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
