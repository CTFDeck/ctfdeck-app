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
import { TOOLS, ToolCategory } from '../../app/core/constants/tools';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'spartan-menubar',
  standalone: true,
  imports: [
    CommonModule,
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
  @Output() openCommandRunnerEvent = new EventEmitter<string | undefined>();
  customScripts: any[] = [];

  // si tu l'utilises ailleurs, garde-le cohérent avec les nouvelles catégories
  categories = [
    ToolCategory.PORT_SCANNING,
    ToolCategory.WEB_DISCOVERY,
    ToolCategory.WEB_VULN_SCAN,
    ToolCategory.REVERSE_SHELL,
    ToolCategory.EXPLOIT,
    ToolCategory.OTHER,
  ];

  tools = TOOLS;
  protected readonly ToolCategory = ToolCategory;

  navigate(path: string) {
    this.router.navigate([path]);
  }

  openExternal(url: string) {
    window.open(url, '_blank', 'noopener');
  }

  openTargetManager(mode: 'view' | 'add' | 'delete') {
    this.openTargetManagerEvent.emit(mode);
  }

  openCommandRunner(toolId?: string) {
    console.log('Menubar emitting openCommandRunner event with toolId:', toolId);
    this.openCommandRunnerEvent.emit(toolId);
  }

  getToolsByCategory(category: ToolCategory) {
    return this.tools.filter(t => t.category === category);
  }

  openScriptImporter(): void {
    console.log('Opening script importer...');
  }

  manageCustomScripts(): void {
    console.log('Managing custom scripts...');
  }

  saveTargets() {
    console.log('Targets already saved in cookies');
  }
}
