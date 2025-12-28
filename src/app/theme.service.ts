import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private _isDark = signal<boolean>(false);

  readonly isDark = this._isDark.asReadonly();

  constructor() {
    this.init();
  }

  init(): void {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark') {
        this.setTheme('dark');
        return;
      }
      if (saved === 'light') {
        this.setTheme('light');
        return;
      }
    } catch (e) {
      // ignore localStorage errors
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      this.setTheme('dark');
    } else {
      this.setTheme('light');
    }
  }

  toggle(): void {
    this.setTheme(this._isDark() ? 'light' : 'dark');
  }

  setTheme(theme: Theme): void {
    const isDark = theme === 'dark';
    this._isDark.set(isDark);
    try {
      if (isDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    } catch (e) {
      // ignore
    }
  }
}
