// src/app/shell/menubar/translate.pipe.ts
import { Pipe, PipeTransform, inject, ChangeDetectorRef } from '@angular/core';
import { effect } from '@angular/core';
import { I18nService } from './i18n.service';

@Pipe({
  name: 'translate',
  standalone: true,
  // pas de pure:false nécessaire grâce à l'effect ci-dessous
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor() {
    // Re-trigger change detection quand la langue change
    effect(() => {
      this.i18n.currentLang(); // lecture du signal pour s'y abonner
      this.cdr.markForCheck();
    });
  }

  transform(key: string): string {
    return this.i18n.translate(key);
  }
}