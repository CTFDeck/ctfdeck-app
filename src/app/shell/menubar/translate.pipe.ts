import { Pipe, PipeTransform, inject, ChangeDetectorRef } from '@angular/core';
import { effect } from '@angular/core';
import { I18nService } from './i18n.service';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor() {
    effect(() => {
      this.i18n.currentLang();
      this.cdr.markForCheck();
    });
  }

  transform(key: string, params: Record<string, string | number> = {}): string {
    return this.i18n.translate(key, params);
  }
}
