import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Marked, type Tokens, type RendererObject } from 'marked';
import DOMPurify from 'dompurify';
import JSZip from 'jszip';
import morphdom from 'morphdom';
import { HlmButtonImports } from '@ctfdeck/helm/button';
import { HlmInputImports } from '@ctfdeck/helm/input';
import { HlmLabelImports } from '@ctfdeck/helm/label';
import { HlmTooltipImports } from '@ctfdeck/helm/tooltip';
import { BrnTooltipImports } from '@spartan-ng/brain/tooltip';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideAlertCircle,
  lucideCheckCircle2,
  lucideCloud,
  lucideCloudUpload,
  lucideColumns2,
  lucideDownload,
  lucideEdit,
  lucideEye,
  lucideImage,
  lucideSave,
  lucideTrash2,
  lucideVideo,
  lucideX,
  lucideChevronLeft,
  lucideHeading1,
  lucideHeading2,
  lucideHeading3,
  lucideBold,
  lucideItalic,
  lucideLink,
  lucideList,
  lucideListOrdered,
  lucideQuote,
  lucideCode,
} from '@ng-icons/lucide';
import { toast } from 'ngx-sonner';
import { WriteUpStore } from '../state/writeup.store';
import { MediaClientService } from '../../media/infrastructure/media-client.service';
import { TranslatePipe } from '../../../shell/menubar/translate.pipe';
import { I18nService } from '../../../shell/menubar/i18n.service';
import { DEFAULT_WRITEUP_NAME } from '../../../shared/constants/default-item-names.constants';

@Component({
  selector: 'app-writeup-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HlmButtonImports,
    HlmInputImports,
    ...HlmLabelImports,
    NgIcon,
    ...HlmTooltipImports,
    ...BrnTooltipImports,
    TranslatePipe,
  ],
  providers: [
    provideIcons({
      lucideSave,
      lucideEye,
      lucideEdit,
      lucideTrash2,
      lucideImage,
      lucideVideo,
      lucideChevronLeft,
      lucideDownload,
      lucideCloud,
      lucideCloudUpload,
      lucideCheckCircle2,
      lucideAlertCircle,
      lucideX,
      lucideColumns2,
      lucideHeading1,
      lucideHeading2,
      lucideHeading3,
      lucideBold,
      lucideItalic,
      lucideLink,
      lucideList,
      lucideListOrdered,
      lucideQuote,
      lucideCode,
    }),
  ],
  templateUrl: './writeup-editor.component.html',
  styleUrls: ['./writeup-editor.component.css'],
})
export class WriteUpEditorComponent implements OnInit, OnDestroy {
  private static readonly MAX_AUTO_WRITEUP_TITLE_LENGTH = 30;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private writeUpStore = inject(WriteUpStore);
  private mediaClient = inject(MediaClientService);

  private readonly i18n = inject(I18nService);

  @ViewChild('editor') editor!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('previewBody') previewBody!: ElementRef<HTMLDivElement>;
  @ViewChild('splitContainer') splitContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('splitter') splitter?: ElementRef<HTMLDivElement>;

  content = '';
  name = '';

  readonly mode = signal<'edit' | 'preview' | 'split'>('split');
  readonly splitRatio = signal(50);
  readonly isResizingSplit = signal(false);
  readonly isSaving = signal(false);
  readonly isLoading = signal(false);
  readonly isInitialLoad = signal(true);
  readonly syncState = signal<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  readonly hoveredTag = signal<string | null>(null);
  readonly displayedTag = signal<string | null>(null);
  readonly showLinkDialog = signal(false);
  linkText = '';
  linkUrl = '';

  private clearTagTimer: ReturnType<typeof setTimeout> | null = null;
  private mediaUrls = new Map<string, string>();
  private loadingMedia = new Set<string>();
  private autoSave$ = new Subject<void>();
  private render$ = new Subject<void>();
  private subscriptions = new Subscription();
  private writeUpId: string | null = null;
  private autoTitleEnabled = false;
  private suppressNameChangeHandler = false;
  private markedInstance = new Marked({ breaks: true });
  private lastHoveredEl: HTMLElement | null = null;
  private mediaUpdateTimer: ReturnType<typeof setTimeout> | null = null;
  private splitMoveHandler?: (event: MouseEvent | TouchEvent) => void;
  private splitUpHandler?: () => void;

  constructor() {
    const renderer: RendererObject = {
      heading: (token: Tokens.Heading) => {
        const tag = `h${token.depth}`;
        const content = this.markedInstance.parseInline(token.text) as string;
        return `<${tag} title="Type: ${tag.toUpperCase()}">${content}</${tag}>`;
      },
      paragraph: (token: Tokens.Paragraph) => {
        const content = this.markedInstance.parseInline(token.text) as string;
        return `<p title="Type: Paragraph">${content}</p>`;
      },
      blockquote: (token: Tokens.Blockquote) => {
        const content = this.markedInstance.parse(token.text) as string;
        return `<blockquote title="Type: Blockquote">${content}</blockquote>`;
      },
      link: ({ href, title, text }: Tokens.Link) => {
        return `<a href="${href}" title="Type: Link${title ? ' - ' + title : ''}">${text}</a>`;
      },
      codespan: ({ text }: Tokens.Codespan) => {
        return `<code title="Type: Inline Code">${text}</code>`;
      },
      image: (token: Tokens.Image) => {
        const { href, title, text } = token;
        const resolvedHref = this.resolveMedia(href);
        return `<img src="${resolvedHref}" alt="${text}" title="Type: Image${title ? ' - ' + title : ''}">`;
      },
      listitem: (token: Tokens.ListItem) => {
        const content = this.markedInstance.parse(token.text) as string;
        return `<li title="Type: List Item">${content}</li>`;
      },
      table: (token: Tokens.Table) => {
        let headerHtml = '<thead><tr>';

        token.header.forEach((cell) => {
          const style = cell.align ? `style="text-align: ${cell.align}"` : '';
          headerHtml += `<th title="Type: Table Header" ${style}>${this.markedInstance.parseInline(cell.text) as string}</th>`;
        });
        headerHtml += '</tr></thead>';

        let bodyHtml = '<tbody>';

        token.rows.forEach((row) => {
          bodyHtml += '<tr>';
          row.forEach((cell) => {
            const style = cell.align ? `style="text-align: ${cell.align}"` : '';
            bodyHtml += `<td title="Type: Table Cell" ${style}>${this.markedInstance.parseInline(cell.text) as string}</td>`;
          });
          bodyHtml += '</tr>';
        });
        bodyHtml += '</tbody>';
        return `<div class="table-wrapper" title="Type: Table"><table title="Type: Table">${headerHtml}${bodyHtml}</table></div>`;
      },
    };
    this.markedInstance.use({ renderer });
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.route.params.subscribe((params) => {
        const id = params['id'];
        if (!id) {
          return;
        }

        this.writeUpId = id;
        this.loadWriteUp(id).then(() => {
          /* Ignore */
        });
      }),
    );

    this.subscriptions.add(
      this.writeUpStore.activeWriteUp$.subscribe((writeUp) => {
        if (!writeUp) {
          return;
        }

        this.content = writeUp.content;
        this.name = writeUp.name;
        this.autoTitleEnabled = this.isDefaultWriteUpName(writeUp.name);
        this.isInitialLoad.set(false);
        this.updatePreview();
      }),
    );

    this.subscriptions.add(
      this.writeUpStore.isLoading$.subscribe((loading) => {
        this.isLoading.set(loading);
      }),
    );

    this.subscriptions.add(
      this.autoSave$.pipe(debounceTime(1000)).subscribe(() => {
        this.save(true).then(() => {
          /* Ignore */
        });
      }),
    );

    this.subscriptions.add(
      this.render$.pipe(debounceTime(32)).subscribe(() => {
        this.executePreviewUpdate();
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.writeUpStore.closeActiveWriteUp();
    this.cleanupMediaUrls();

    if (this.clearTagTimer) {
      clearTimeout(this.clearTagTimer);
    }

    if (this.mediaUpdateTimer) {
      clearTimeout(this.mediaUpdateTimer);
    }

    this.detachSplitListeners();
  }

  async loadWriteUp(id: string): Promise<void> {
    await this.writeUpStore.selectWriteUp(id);
  }

  updatePreview(): void {
    this.render$.next();
  }

  onContentChange(): void {
    this.autoNameWriteUpFromContent();
    this.syncState.set('unsaved');

    if (this.mode() === 'split' || this.mode() === 'preview') {
      this.updatePreview();
    }

    this.autoSave$.next();
  }

  onNameChange(): void {
    if (this.suppressNameChangeHandler) {
      return;
    }

    this.autoTitleEnabled = false;
    this.syncState.set('unsaved');
    this.autoSave$.next();
  }

  async save(silent = false): Promise<void> {
    if (this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    this.syncState.set('saving');

    try {
      const success = await this.writeUpStore.saveActiveWriteUp(this.content, this.name);

      if (success) {
        this.syncState.set('saved');
        if (!silent) {
          toast.success('Writeup saved successfully');
        }
        return;
      }

      this.syncState.set('error');
      if (!silent) {
        toast.error('Failed to save writeup');
      }
    } catch {
      this.syncState.set('error');
      if (!silent) {
        toast.error('Error saving writeup');
      }
    } finally {
      this.isSaving.set(false);
    }
  }

  async delete(): Promise<void> {
    if (!this.writeUpId || !confirm(this.i18n.translate('writeup.delete.confirm'))) {
      return;
    }

    await this.writeUpStore.deleteWriteUp(this.writeUpId);
    await this.router.navigate(['/terminal']);
  }

  async exportZip(): Promise<void> {
    const fileName = (this.name || 'Untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    toast.info('Preparing export...');

    const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
    const mediaIds = [...new Set(this.content.match(uuidPattern) ?? [])];
    const mediaFiles = new Map<string, { fileName: string; mimeType: string; data: Uint8Array }>();

    await Promise.all(
      mediaIds.map(async (id) => {
        try {
          const result = await this.mediaClient.load(id);
          if (result.success && result.media) {
            mediaFiles.set(id, result.media);
          }
        } catch (error) {
          console.warn(`[Export] Could not load media ${id}`, error);
        }
      }),
    );

    let exportedContent = this.content.replace(/media:\/\//g, '');

    for (const [id, file] of mediaFiles) {
      const safeName = file.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      exportedContent = exportedContent.replace(
        new RegExp(id.replace(/-/g, '\\-'), 'g'),
        `./media/${safeName}`,
      );
    }

    const zip = new JSZip();
    const folder = zip.folder(fileName)!;
    folder.file('writeup.md', exportedContent);

    if (mediaFiles.size > 0) {
      const mediaFolder = folder.folder('media')!;
      for (const [, file] of mediaFiles) {
        const safeName = file.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        mediaFolder.file(safeName, file.data);
      }
    }

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${fileName}.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(anchor);

    toast.success(`Exported ${mediaFiles.size} media file(s) + writeup.md`);
  }

  setMode(mode: 'edit' | 'preview' | 'split'): void {
    this.mode.set(mode);

    if (mode !== 'edit') {
      setTimeout(() => this.updatePreview());
    }
  }

  onSplitResizeStart(event: MouseEvent | TouchEvent): void {
    if (this.mode() !== 'split') {
      return;
    }

    event.preventDefault();
    this.splitter?.nativeElement.focus();
    this.isResizingSplit.set(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    this.splitMoveHandler = (moveEvent: MouseEvent | TouchEvent) => this.onSplitResizeMove(moveEvent);
    this.splitUpHandler = () => this.onSplitResizeEnd();

    window.addEventListener('mousemove', this.splitMoveHandler);
    window.addEventListener('touchmove', this.splitMoveHandler, { passive: false });
    window.addEventListener('mouseup', this.splitUpHandler);
    window.addEventListener('touchend', this.splitUpHandler);
  }

  onSplitResizeKeydown(event: KeyboardEvent): void {
    if (this.mode() !== 'split') {
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'Left') {
      event.preventDefault();
      this.splitRatio.set(Math.max(25, this.splitRatio() - 2));
      return;
    }

    if (event.key === 'ArrowRight' || event.key === 'Right') {
      event.preventDefault();
      this.splitRatio.set(Math.min(75, this.splitRatio() + 2));
    }
  }

  focusSplitter(event: MouseEvent): void {
    (event.currentTarget as HTMLDivElement | null)?.focus();
  }

  private onSplitResizeMove(event: MouseEvent | TouchEvent): void {
    if (!this.isResizingSplit() || !this.splitContainer?.nativeElement) {
      return;
    }

    if ('touches' in event && event.touches.length > 0) {
      event.preventDefault();
    }

    const pointerX =
      'touches' in event
        ? (event.touches[0]?.clientX ?? 0)
        : event.clientX;

    const rect = this.splitContainer.nativeElement.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }

    const rawRatio = ((pointerX - rect.left) / rect.width) * 100;
    const clampedRatio = Math.max(25, Math.min(75, rawRatio));
    this.splitRatio.set(clampedRatio);
  }

  private onSplitResizeEnd(): void {
    this.isResizingSplit.set(false);
    this.detachSplitListeners();
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  private detachSplitListeners(): void {
    if (this.splitMoveHandler) {
      window.removeEventListener('mousemove', this.splitMoveHandler);
      window.removeEventListener('touchmove', this.splitMoveHandler);
      this.splitMoveHandler = undefined;
    }

    if (this.splitUpHandler) {
      window.removeEventListener('mouseup', this.splitUpHandler);
      window.removeEventListener('touchend', this.splitUpHandler);
      this.splitUpHandler = undefined;
    }
  }

  onPreviewMouseOver(event: MouseEvent | FocusEvent): void {
    let element = event.target as HTMLElement | null;

    while (element && element !== event.currentTarget) {
      const title = element.getAttribute('title') || element.getAttribute('data-title');

      if (title?.startsWith('Type: ')) {
        this.setBadgeTag(title.replace('Type: ', ''));

        if (element.hasAttribute('title')) {
          element.setAttribute('data-title', title);
          element.removeAttribute('title');
          this.lastHoveredEl = element;
        }

        return;
      }

      element = element.parentElement;
    }

    this.restoreLastHovered();
  }

  onPreviewMouseOut(): void {
    this.restoreLastHovered();
  }

  onEditorKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      this.save().then(() => {
        /* Ignore */
      });
      return;
    }

    if (event.key !== 'Enter') {
      return;
    }

    const textarea = this.editor.nativeElement;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = this.content.substring(0, cursorPos);
    const lineStart = textBeforeCursor.lastIndexOf('\n') + 1;
    const currentLine = textBeforeCursor.substring(lineStart);

    const bulletMatch = currentLine.match(/^(\s*)([-*+]|\d+\.?)(\s*)/);
    if (bulletMatch) {
      event.preventDefault();
      const [, indent, marker] = bulletMatch;
      let newMarker: string;

      if (/^\d+\.?$/.test(marker)) {
        const num = parseInt(marker.replace('.', ''), 10);
        newMarker = `${num + 1}.`;
      } else {
        newMarker = marker;
      }

      const insertText = `\n${indent}${newMarker} `;
      this.content = textBeforeCursor + insertText + this.content.substring(cursorPos);

      setTimeout(() => {
        const newPos = cursorPos + insertText.length;
        textarea.selectionStart = newPos;
        textarea.selectionEnd = newPos;
        this.onContentChange();
      });
    }
  }

  async onPaste(event: ClipboardEvent): Promise<void> {
    const items = event.clipboardData?.items;
    if (!items) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let index = 0; index < items.length; index++) {
      if (!items[index].type.includes('image')) {
        continue;
      }

      const file = items[index].getAsFile();
      if (!file) {
        continue;
      }

      event.preventDefault();
      await this.uploadAndInsertMedia(file);
    }
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    const files = event.dataTransfer?.files;

    if (!files || files.length === 0) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        await this.uploadAndInsertMedia(file);
      }
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  private autoNameWriteUpFromContent(): void {
    if (!this.autoTitleEnabled) {
      return;
    }

    const autoTitle = this.extractAutoTitle(this.content);
    if (!autoTitle) {
      return;
    }

    if (this.name === autoTitle) {
      return;
    }

    this.suppressNameChangeHandler = true;
    try {
      this.name = autoTitle;
    } finally {
      this.suppressNameChangeHandler = false;
    }
  }

  private isDefaultWriteUpName(name: string): boolean {
    return name.trim().toLowerCase() === DEFAULT_WRITEUP_NAME.toLowerCase();
  }

  private extractAutoTitle(content: string): string {
    const normalized = content.replace(/\r\n/g, '\n').trimStart();
    if (!normalized) {
      return '';
    }

    const firstLine = normalized.split('\n', 1)[0] ?? '';
    return firstLine
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, WriteUpEditorComponent.MAX_AUTO_WRITEUP_TITLE_LENGTH)
      .trim();
  }

  private executePreviewUpdate(): void {
    if (!this.previewBody?.nativeElement) {
      return;
    }

    const contentWithPrefixes = this.content.replace(
      /(!\[[^\]]*]\()([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(\))/gi,
      '$1media://$2$3',
    );

    const rawHtml = this.markedInstance.parse(contentWithPrefixes) as string;

    const processedHtml = rawHtml.replace(
      /<(video|source)[^>]+src="([^"]+)"/g,
      (match, _tag, mediaId) => {
        return match.replace(mediaId, this.resolveMedia(mediaId));
      },
    );

    const sanitized = DOMPurify.sanitize(processedHtml, {
      ADD_TAGS: ['video', 'source', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
      ADD_ATTR: ['controls', 'autoplay', 'loop', 'muted', 'playsinline', 'src', 'type', 'style'],
      ALLOWED_URI_REGEXP:
        /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data|blob|media):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    });

    const temp = document.createElement('div');
    temp.innerHTML = sanitized;

    morphdom(this.previewBody.nativeElement, temp, {
      childrenOnly: true,
    });
  }

  private resolveMedia(mediaId: string): string {
    if (mediaId.startsWith('http') || mediaId.startsWith('data:') || mediaId.startsWith('blob:')) {
      return mediaId;
    }

    const cleanId = mediaId.startsWith('media://') ? mediaId.substring(8) : mediaId;
    const cachedUrl = this.mediaUrls.get(cleanId);

    if (cachedUrl) {
      return cachedUrl;
    }

    if (!this.loadingMedia.has(cleanId)) {
      this.loadingMedia.add(cleanId);

      this.mediaClient
        .load(cleanId)
        .then((result) => {
          if (result.success && result.media) {
            const blob = new Blob([result.media.data as never], { type: result.media.mimeType });
            const url = window.URL.createObjectURL(blob);
            this.mediaUrls.set(cleanId, url);

            if (this.mediaUpdateTimer) {
              clearTimeout(this.mediaUpdateTimer);
            }

            this.mediaUpdateTimer = setTimeout(() => this.updatePreview(), 50);
          } else {
            console.warn(`[WriteUpEditor] Failed to load media ${cleanId}:`, result);
          }

          this.loadingMedia.delete(cleanId);
        })
        .catch((error) => {
          console.error(`[WriteUpEditor] Error loading media ${cleanId}:`, error);
          this.loadingMedia.delete(cleanId);
        });
    }

    return '';
  }

  private cleanupMediaUrls(): void {
    this.mediaUrls.forEach((url) => window.URL.revokeObjectURL(url));
    this.mediaUrls.clear();
  }

  private setBadgeTag(value: string | null): void {
    if (this.clearTagTimer) {
      clearTimeout(this.clearTagTimer);
    }

    if (value) {
      this.displayedTag.set(value);
      this.hoveredTag.set(value);
      return;
    }

    this.hoveredTag.set(null);
    this.clearTagTimer = setTimeout(() => this.displayedTag.set(null), 200);
  }

  private restoreLastHovered(): void {
    if (this.lastHoveredEl) {
      const title = this.lastHoveredEl.getAttribute('data-title');
      if (title) {
        this.lastHoveredEl.setAttribute('title', title);
        this.lastHoveredEl.removeAttribute('data-title');
      }
      this.lastHoveredEl = null;
    }

    this.setBadgeTag(null);
  }

  private async uploadAndInsertMedia(file: File): Promise<void> {
    toast.info(`Uploading ${file.name}...`);

    try {
      const result = await this.mediaClient.uploadFile(file);

      if (!result.success) {
        return;
      }

      const url = window.URL.createObjectURL(file);
      this.mediaUrls.set(result.mediaId, url);

      const isVideo = file.type.startsWith('video/');
      const markdown = isVideo
        ? `\n<video src="media://${result.mediaId}" controls style="max-width: 100%; border-radius: 8px;"></video>\n`
        : `\n![${file.name}](media://${result.mediaId})\n`;

      this.insertAtCursor(markdown);
      toast.success('Media uploaded and inserted');
      this.autoSave$.next();
    } catch {
      toast.error('Media upload failed');
    }
  }

  private insertAtCursor(text: string): void {
    const textarea = this.editor.nativeElement;
    const scrollTop = textarea.scrollTop;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    queueMicrotask(() => {
      this.content = this.content.substring(0, start) + text + this.content.substring(end);

      setTimeout(() => {
        textarea.scrollTop = scrollTop;
        textarea.selectionStart = start + text.length;
        textarea.selectionEnd = start + text.length;
        this.updatePreview();
      });
    });
  }

  toggleBold(): void {
    const textarea = this.editor.nativeElement;
    const scrollTop = textarea.scrollTop;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start !== end) {
      const selectedText = this.content.substring(start, end);
      const wrapped = `**${selectedText}**`;
      this.content = this.content.substring(0, start) + wrapped + this.content.substring(end);
      setTimeout(() => {
        textarea.scrollTop = scrollTop;
        textarea.selectionStart = start + 2;
        textarea.selectionEnd = start + 2 + selectedText.length;
        this.updatePreview();
      });
    } else {
      this.insertAtCursor('****');
      setTimeout(() => {
        textarea.scrollTop = scrollTop;
        textarea.selectionStart = start + 2;
        textarea.selectionEnd = start + 2;
      });
    }
  }

  toggleItalic(): void {
    const textarea = this.editor.nativeElement;
    const scrollTop = textarea.scrollTop;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start !== end) {
      const selectedText = this.content.substring(start, end);
      const wrapped = `*${selectedText}*`;
      this.content = this.content.substring(0, start) + wrapped + this.content.substring(end);
      setTimeout(() => {
        textarea.scrollTop = scrollTop;
        textarea.selectionStart = start + 1;
        textarea.selectionEnd = start + 1 + selectedText.length;
        this.updatePreview();
      });
    } else {
      this.insertAtCursor('**');
      setTimeout(() => {
        textarea.scrollTop = scrollTop;
        textarea.selectionStart = start + 1;
        textarea.selectionEnd = start + 1;
      });
    }
  }

  addHeading(level: number): void {
    const textarea = this.editor.nativeElement;
    const scrollTop = textarea.scrollTop;
    const start = textarea.selectionStart;
    const lineStart = this.content.lastIndexOf('\n', start - 1) + 1;
    const prefix = '#'.repeat(level) + ' ';

    this.content =
      this.content.substring(0, lineStart) + prefix + this.content.substring(lineStart);
    setTimeout(() => {
      textarea.scrollTop = scrollTop;
      textarea.selectionStart = start + prefix.length;
      textarea.selectionEnd = start + prefix.length;
      this.updatePreview();
    });
  }

  openLinkDialog(): void {
    const textarea = this.editor.nativeElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = this.content.substring(start, end);
    this.linkText = selectedText;
    this.linkUrl = '';
    this.showLinkDialog.set(true);
  }

  closeLinkDialog(): void {
    this.showLinkDialog.set(false);
    this.linkText = '';
    this.linkUrl = '';
  }

  insertLink(): void {
    if (!this.linkText || !this.linkUrl) {
      return;
    }

    const markdown = `[${this.linkText}](${this.linkUrl})`;
    this.insertAtCursor(markdown);
    this.closeLinkDialog();
  }

  addList(ordered = false): void {
    const textarea = this.editor.nativeElement;
    const scrollTop = textarea.scrollTop;
    const start = textarea.selectionStart;
    const lineStart = this.content.lastIndexOf('\n', start - 1) + 1;
    const prefix = ordered ? '1. ' : '- ';

    this.content =
      this.content.substring(0, lineStart) + prefix + this.content.substring(lineStart);
    setTimeout(() => {
      textarea.scrollTop = scrollTop;
      textarea.selectionStart = start + prefix.length;
      textarea.selectionEnd = start + prefix.length;
      this.updatePreview();
    });
  }

  addQuote(): void {
    const textarea = this.editor.nativeElement;
    const scrollTop = textarea.scrollTop;
    const start = textarea.selectionStart;
    const lineStart = this.content.lastIndexOf('\n', start - 1) + 1;
    const prefix = '> ';

    this.content =
      this.content.substring(0, lineStart) + prefix + this.content.substring(lineStart);
    setTimeout(() => {
      textarea.scrollTop = scrollTop;
      textarea.selectionStart = start + prefix.length;
      textarea.selectionEnd = start + prefix.length;
      this.updatePreview();
    });
  }

  addCode(): void {
    const textarea = this.editor.nativeElement;
    const scrollTop = textarea.scrollTop;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = this.content.substring(start, end);

    if (selectedText.includes('\n')) {
      const wrapped = `\`\`\`\n${selectedText}\n\`\`\``;
      this.content = this.content.substring(0, start) + wrapped + this.content.substring(end);
      setTimeout(() => {
        textarea.scrollTop = scrollTop;
        textarea.selectionStart = start + 4;
        textarea.selectionEnd = start + 4 + selectedText.length;
        this.updatePreview();
      });
    } else {
      const wrapped = `\`${selectedText}\``;
      this.content = this.content.substring(0, start) + wrapped + this.content.substring(end);
      setTimeout(() => {
        textarea.scrollTop = scrollTop;
        textarea.selectionStart = start + 1;
        textarea.selectionEnd = start + 1 + selectedText.length;
        this.updatePreview();
      });
    }
  }

  triggerImageUpload(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await this.uploadAndInsertMedia(file);
      }
    };
    input.click();
  }
}
