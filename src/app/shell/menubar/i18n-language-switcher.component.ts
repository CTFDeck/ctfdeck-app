// src/app/shell/menubar/i18n-language-switcher.component.ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HlmButton, provideBrnButtonConfig } from '@ctfdeck/helm/button';
import { HlmMenu, HlmMenuItem } from '@ctfdeck/helm/menu';
import { BrnMenuTrigger as I18nMenuTrigger } from '@spartan-ng/brain/menu';
import { I18nService, type SupportedLang } from './i18n.service';

@Component({
  selector: 'button[i18nLanguageSwitcher]',
  standalone: true,
  imports: [I18nMenuTrigger, HlmMenu, HlmMenuItem],
  providers: [provideBrnButtonConfig({ variant: 'ghost', size: 'icon' })],
  hostDirectives: [{ directive: HlmButton }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    type: 'button',
    'aria-label': 'Select language',
  },
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      color: var(--sidebar-foreground);
    }
  `],
  template: `
    <span [brnMenuTriggerFor]="languageMenu">{{ currentFlag }}</span>

    <ng-template #languageMenu>
      <hlm-menu class="w-40">
        <button hlmMenuItem (click)="selectLanguage('fr')">🇫🇷 Français</button>
        <button hlmMenuItem (click)="selectLanguage('en')">🇬🇧 English</button>
        <button hlmMenuItem (click)="selectLanguage('es')">🇪🇸 Español</button>
      </hlm-menu>
    </ng-template>
  `,
})
export class I18nLanguageSwitcherComponent {
  private readonly i18n = inject(I18nService);

  private readonly flags: Record<SupportedLang, string> = {
    fr: '🇫🇷',
    en: '🇬🇧',
    es: '🇪🇸',
  };

  get currentFlag(): string {
    return this.flags[this.i18n.currentLang()];
  }

  selectLanguage(lang: SupportedLang): void {
    this.i18n.setLang(lang);
  }
}