import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HlmButton, provideBrnButtonConfig } from '@ctfdeck/helm/button';
import { ThemeService } from '../../app/theme.service';

@Component({
  // make this a host button so we can apply HlmButton via hostDirectives
  selector: 'button[themeToggle]',
  standalone: true,
  providers: [provideBrnButtonConfig({ variant: 'ghost', size: 'icon' })],
  hostDirectives: [{ directive: HlmButton }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    type: 'button',
    '(click)': '_onClick()',
    'aria-label': 'Toggle theme',
  },
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
        color: var(--sidebar-foreground);
      }
    `,
  ],
  template: `{{ theme.isDark() ? '☀️' : '🌙' }}`,
})
export class ThemeToggle {
  // expose as public so the template can read the signal
  readonly theme = inject(ThemeService);

  _onClick(): void {
    this.theme.toggle();
  }
}
