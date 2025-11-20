import { Component } from '@angular/core';
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
    HlmMenuShortcut,
    HlmMenuSeparator,
    HlmMenuBarItem,
    HlmMenuItemCheck,
    HlmMenuItemRadio,
    HlmMenuGroup,
    HlmMenuItemCheckbox,
    HlmMenuItemRadioIndicator,
    ThemeToggle,
  ],
  templateUrl: './menubar.html',
  styleUrls: ['./menubar.css'],
})
export class Menubar {}
