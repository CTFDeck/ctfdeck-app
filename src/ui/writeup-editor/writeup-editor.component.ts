import { Component, OnInit, OnDestroy, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { WriteUpStoreService } from '../../app/core/services/writeup-store.service';
import { MediaService } from '../../app/core/services/media.service';
import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import JSZip from 'jszip';
import morphdom from 'morphdom';
import { Subject, Subscription, timer } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { HlmButtonImports } from '@ctfdeck/helm/button';
import { HlmInputImports } from '@ctfdeck/helm/input';
import { HlmTooltipImports } from '@ctfdeck/helm/tooltip';
import { BrnTooltipImports } from '@spartan-ng/brain/tooltip';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSave,
  lucideEye,
  lucideEdit,
  lucideTrash2,
  lucideImage,
  lucideVideo,
  lucideChevronLeft,
  lucideDownload,
} from '@ng-icons/lucide';
import { toast } from 'ngx-sonner';

@Component({
  selector: 'app-writeup-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HlmButtonImports,
    ...HlmInputImports,
    NgIcon,
    ...HlmTooltipImports,
    ...BrnTooltipImports,
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
    }),
  ],
  templateUrl: './writeup-editor.component.html',
  styleUrls: ['./writeup-editor.component.css'],
})
export class WriteUpEditorComponent implements OnInit, OnDestroy {
  @ViewChild('editor') editor!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('previewBody') previewBody!: ElementRef<HTMLDivElement>;

  content = '';
  name = '';
  // previewHtml no longer needed — morphdom patches the live DOM directly
  
  mode = signal<'edit' | 'preview' | 'split'>('split');
  isSaving = signal(false);
  isLoading = signal(false);
  /** Drives badge opacity (null = transparent) */
  hoveredTag = signal<string | null>(null);
  /** Keeps last non-null value during fade-out so text doesn't flash to empty */
  displayedTag = signal<string | null>(null);

  private clearTagTimer: any;

  private mediaUrls = new Map<string, string>();
  private loadingMedia = new Set<string>();
  private autoSave$ = new Subject<void>();

  private subscriptions = new Subscription();
  private writeUpId: string | null = null;
  private markedInstance = new Marked();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private writeUpStore: WriteUpStoreService,
    private mediaService: MediaService,
  ) {
    // Configure marked instance
    this.markedInstance.use({
      renderer: {
        heading: (token: any) => {
          const tag = `h${token.depth}`;
          const content = this.markedInstance.parseInline(token.text) as string;
          return `<${tag} title="Type: ${tag.toUpperCase()}">${content}</${tag}>`;
        },
        paragraph: (token: any) => {
          // parseInline expects a string, not a token array
          const content = this.markedInstance.parseInline(token.text) as string;
          return `<p title="Type: Paragraph">${content}</p>`;
        },
        blockquote: (token: any) => {
          const content = this.markedInstance.parse(token.text) as string;
          return `<blockquote title="Type: Blockquote">${content}</blockquote>`;
        },
        link: ({ href, title, text }) => {
          return `<a href="${href}" title="Type: Link${title ? ' - ' + title : ''}">${text}</a>`;
        },
        codespan: ({ text }) => {
          return `<code title="Type: Inline Code">${text}</code>`;
        },
        image: (token: any) => {
          const { href, title, text } = token;
          console.log(`[WriteUpEditor] renderer.image hit! Token:`, token);
          const resolvedHref = this.resolveMedia(href);
          console.log(`[WriteUpEditor] renderer.image resolved href: ${resolvedHref}`);
          return `<img src="${resolvedHref}" alt="${text}" title="Type: Image${title ? ' - ' + title : ''}" style="max-width: 100%; border-radius: 8px;">`;
        }
      },
      walkTokens: (token: any) => {
        if (token.type === 'text' && token.text.includes('![')) {
          console.log(`[WriteUpEditor] Found text token that looks like an image but wasn't parsed:`, token);
        } else if (token.type === 'image') {
          console.log(`[WriteUpEditor] Found image token:`, token);
        }
      }
    });
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.route.params.subscribe((params) => {
        const id = params['id'];
        if (id) {
          this.writeUpId = id;
          this.loadWriteUp(id);
        }
      })
    );

    this.subscriptions.add(
      this.writeUpStore.activeWriteUp$.subscribe((writeUp) => {
        if (writeUp) {
          this.content = writeUp.content;
          this.name = writeUp.name;
          this.updatePreview();
        }
      })
    );

    this.subscriptions.add(
      this.writeUpStore.loading$.subscribe((loading) => {
        this.isLoading.set(loading);
      })
    );

    this.subscriptions.add(
      this.autoSave$.pipe(
        debounceTime(1000)
      ).subscribe(() => {
        this.save('Auto-saved');
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.writeUpStore.closeActiveWriteUp();
    this.cleanupMediaUrls();
  }

  private cleanupMediaUrls() {
    this.mediaUrls.forEach(url => window.URL.revokeObjectURL(url));
    this.mediaUrls.clear();
  }

  async loadWriteUp(id: string) {
    await this.writeUpStore.selectWriteUp(id);
  }

  updatePreview() {
    // Auto-prefix UUID-like media IDs in markdown image syntax to ensure marked identifies them as URLs
    const contentWithPrefixes = this.content.replace(/(\!\[[^\]]*\]\()([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(\))/gi, '$1media://$2$3');
    
    const rawHtml = this.markedInstance.parse(contentWithPrefixes) as string;
    
    // Resolve paths in video/source tags manually
    const processedHtml = rawHtml.replace(/<(video|source)[^>]+src="([^"]+)"/g, (match, _tag, mediaId) => {
      return match.replace(mediaId, this.resolveMedia(mediaId));
    });

    const sanitized = DOMPurify.sanitize(processedHtml, {
      ADD_TAGS: ['video', 'source'],
      ADD_ATTR: ['controls', 'autoplay', 'loop', 'muted', 'playsinline', 'src', 'type'],
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data|blob|media):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i
    });

    // Use morphdom to patch only changed nodes — preserves videos, scroll, loaded images
    if (this.previewBody?.nativeElement) {
      const temp = document.createElement('div');
      temp.innerHTML = sanitized;
      morphdom(this.previewBody.nativeElement, temp, {
        childrenOnly: true,
        onBeforeElUpdated: (fromEl, toEl) => {
          // Never touch a video element — it would interrupt playback
          if (fromEl.nodeName === 'VIDEO') return false;
          // Don't wipe a loaded image src with an empty one (still fetching)
          if (fromEl.nodeName === 'IMG') {
            const fromSrc = (fromEl as HTMLImageElement).src;
            const toSrc = (toEl as HTMLImageElement).getAttribute('src');
            if (fromSrc && fromSrc.startsWith('blob:') && !toSrc) return false;
          }
          // Skip if identical
          return !fromEl.isEqualNode(toEl);
        },
      });
    }
  }

  private resolveMedia(mediaId: string): string {
    // If it's already a URL or a data URI, return as is
    if (mediaId.startsWith('http') || mediaId.startsWith('data:') || mediaId.startsWith('blob:')) {
      return mediaId;
    }

    // Strip custom media:// protocol if present
    const cleanId = mediaId.startsWith('media://') ? mediaId.substring(8) : mediaId;

    // Check if we have a cached object URL
    const cachedUrl = this.mediaUrls.get(cleanId);
    if (cachedUrl) {
      return cachedUrl;
    }

    // If not already loading, trigger load
    if (!this.loadingMedia.has(cleanId)) {
      console.log(`[WriteUpEditor] Loading media: ${cleanId}`);
      this.loadingMedia.add(cleanId);
      this.mediaService.load(cleanId).then(result => {
        if (result.success && result.media) {
          const blob = new Blob([result.media.data as any], { type: result.media.mimeType });
          const url = window.URL.createObjectURL(blob);
          console.log(`[WriteUpEditor] Media loaded: ${cleanId} -> ${url}`);
          this.mediaUrls.set(cleanId, url);
          this.updatePreview(); // Re-render to show the now-loaded media
        } else {
          console.warn(`[WriteUpEditor] Failed to load media ${cleanId}:`, result);
        }
        this.loadingMedia.delete(cleanId);
      }).catch(err => {
        console.error(`[WriteUpEditor] Error loading media ${cleanId}:`, err);
        this.loadingMedia.delete(cleanId);
      });
    }

    // Return a placeholder or empty string while loading
    return ''; 
  }

  onContentChange() {
    if (this.mode() === 'split' || this.mode() === 'preview') {
      this.updatePreview();
    }
    this.autoSave$.next();
  }

  async save(successMessage = 'Writeup saved successfully') {
    this.isSaving.set(true);
    try {
      const success = await this.writeUpStore.saveActiveWriteUp(this.content, this.name);
      if (success) {
        toast.success(successMessage);
      }
    } finally {
      this.isSaving.set(false);
    }
  }

  async delete() {
    if (this.writeUpId && confirm('Are you sure you want to delete this writeup?')) {
      await this.writeUpStore.deleteWriteUp(this.writeUpId);
      this.router.navigate(['/terminal']);
    }
  }

  async exportZip() {
    const fileName = (this.name || 'Untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    toast.info('Preparing export...');

    // 1. Extract all media UUIDs from the content
    const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
    const mediaIds = [...new Set(this.content.match(uuidPattern) ?? [])];

    // 2. Fetch each media (use cache if available, else hit server)
    const mediaFiles = new Map<string, { fileName: string; mimeType: string; data: Uint8Array }>();

    await Promise.all(mediaIds.map(async (id) => {
      try {
        const result = await this.mediaService.load(id);
        if (result.success && result.media) {
          mediaFiles.set(id, result.media);
        }
      } catch (e) {
        console.warn(`[Export] Could not load media ${id}`, e);
      }
    }));

    // 3. Build the updated markdown content with ./media/<filename> paths
    let exportedContent = this.content;
    // Strip media:// prefix first (may or may not be present)
    exportedContent = exportedContent.replace(/media:\/\//g, '');

    for (const [id, file] of mediaFiles) {
      const safeName = file.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      exportedContent = exportedContent.replace(new RegExp(id.replace(/-/g, '\\-'), 'g'), `./media/${safeName}`);
    }

    // 4. Build the ZIP
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

    // 5. Generate and trigger download
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.zip`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast.success(`Exported ${mediaFiles.size} media file(s) + writeup.md`);
  }

  private setBadgeTag(value: string | null) {
    clearTimeout(this.clearTagTimer);
    if (value) {
      this.displayedTag.set(value);
      this.hoveredTag.set(value);
    } else {
      this.hoveredTag.set(null);
      // keep displayedTag alive during the CSS transition, then clear
      this.clearTagTimer = setTimeout(() => this.displayedTag.set(null), 200);
    }
  }

  onPreviewMouseOver(event: MouseEvent) {
    // Walk from the exact target up to find the closest element with a "Type:" title
    // This ensures that hovering an <img> inside a <p> shows "Image" not "Paragraph"
    let el = event.target as HTMLElement | null;
    while (el && el !== event.currentTarget) {
      const title = el.getAttribute('title') || el.getAttribute('data-title');
      if (title?.startsWith('Type: ')) {
        this.setBadgeTag(title.replace('Type: ', ''));
        // Suppress the native browser tooltip bubble
        if (el.hasAttribute('title')) {
          el.setAttribute('data-title', title);
          el.removeAttribute('title');
        }
        return;
      }
      el = el.parentElement;
    }
    this.setBadgeTag(null);
  }

  onPreviewMouseOut(event: MouseEvent) {
    // Restore all elements inside the container that had their title swapped
    const container = event.currentTarget as HTMLElement;
    container.querySelectorAll<HTMLElement>('[data-title]').forEach(el => {
      el.setAttribute('title', el.getAttribute('data-title')!);
      el.removeAttribute('data-title');
    });
    this.setBadgeTag(null);
  }

  goBack() {
    this.router.navigate(['/terminal']);
  }

  setEditorMode(mode: 'edit' | 'preview' | 'split') {
    this.mode.set(mode);
    if (mode !== 'edit') {
      this.updatePreview();
    }
  }

  // Media handling
  async onPaste(event: ClipboardEvent) {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          event.preventDefault();
          await this.uploadAndInsertMedia(file);
        }
      }
    }
  }

  async onDrop(event: DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        await this.uploadAndInsertMedia(file);
      }
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  private async uploadAndInsertMedia(file: File) {
    toast.info(`Uploading ${file.name}...`);
    try {
      const result = await this.mediaService.uploadFile(file);
      if (result.success) {
        // Cache the local file URL immediately using the new mediaId
        // This ensures the preview works instantly without waiting for a re-load
        const url = window.URL.createObjectURL(file);
        this.mediaUrls.set(result.mediaId, url);
        console.log(`[WriteUpEditor] Media uploaded and cached locally: ${result.mediaId} -> ${url}`);

        const isVideo = file.type.startsWith('video/');
        const markdown = isVideo 
          ? `\n<video src="media://${result.mediaId}" controls style="max-width: 100%; border-radius: 8px;"></video>\n`
          : `\n![${file.name}](media://${result.mediaId})\n`;
        
        this.insertAtCursor(markdown);
        toast.success('Media uploaded and inserted');
        this.autoSave$.next();
      }
    } catch (err: any) {
      toast.error('Media upload failed', { description: err?.message || 'Unknown error' });
    }
  }

  private insertAtCursor(text: string) {
    const textarea = this.editor.nativeElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    this.content = this.content.substring(0, start) + text + this.content.substring(end);
    
    // Defer focus and selection update
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
      this.updatePreview();
    });
  }
}
