import { Component, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { BrnMenuTrigger } from '@spartan-ng/brain/menu';
import {
  HlmMenu,
  HlmMenuBar,
  HlmMenuBarItem,
  HlmMenuGroup,
  HlmMenuItem,
  HlmMenuItemSubIndicator,
  HlmMenuSeparator,
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
  
  @Output() openTargetManagerEvent = new EventEmitter<'view' | 'add' | 'delete'>();
  @Output() openCommandRunnerEvent = new EventEmitter<void>();

  navigate(path: string) {
    this.router.navigate([path]);
  }

  openExternal(url: string) {
    window.open(url, '_blank', 'noopener');
  }

  openTargetManager(mode: 'view' | 'add' | 'delete') {
    this.openTargetManagerEvent.emit(mode);
  }

  openCommandRunner() {
    this.openCommandRunnerEvent.emit();
  }

  saveTargets() {
    console.log('Targets already saved in cookies');
  }
}