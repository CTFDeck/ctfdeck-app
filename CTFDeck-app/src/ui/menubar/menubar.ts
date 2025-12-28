import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { BrnMenuTrigger } from '@spartan-ng/brain/menu';

import {
  HlmMenu,
  HlmMenuBar,
  HlmMenuBarItem,
  HlmMenuGroup,
  HlmMenuItem,
  HlmMenuItemCheck,
  HlmMenuItemCheckbox,
  HlmMenuItemRadio,
  HlmMenuItemRadioIndicator,
  HlmMenuItemSubIndicator,
  HlmMenuSeparator,
  HlmMenuShortcut,
  HlmSubMenu,
} from '@ctfdeck/helm/menu';
import { HlmButtonImports } from '@ctfdeck/helm/button';

import { ThemeToggle } from './theme-toggle';

@Component({
  selector: 'spartan-menubar',
  standalone: true,
  imports: [
    BrnMenuTrigger,
    HlmMenu,
    HlmMenuBar,
    HlmSubMenu,
    HlmMenuItem,
    HlmMenuItemSubIndicator,
    HlmMenuSeparator,
    HlmMenuBarItem,
    HlmMenuGroup,
    ThemeToggle,
  ],
  templateUrl: './menubar.html',
  styleUrls: ['./menubar.css'],
})
export class Menubar {
  constructor(private router: Router) {}

  navigate(path: string) {
    this.router.navigate([path]);
  }

  openExternal(url: string) {
    window.open(url, '_blank', 'noopener');
  }
}
