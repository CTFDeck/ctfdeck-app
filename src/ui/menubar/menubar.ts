import { Component, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
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
import { ScriptService } from '../../app/core/services/script.service';
import { Subscription } from 'rxjs';

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
export class Menubar implements OnInit, OnDestroy {
  constructor(
    private router: Router,
    private scriptService: ScriptService,
  ) {}

  @Output() openTargetManagerEvent = new EventEmitter<'view' | 'add' | 'delete'>();
  @Output() openCommandRunnerEvent = new EventEmitter<string | undefined>();
  customScripts: Array<{ id: string; name: string; category: number; template: string }> = [];
  customScriptsLoading = false;
  private subscriptions = new Subscription();

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

  ngOnInit(): void {
    this.subscriptions.add(
      this.scriptService.scripts$.subscribe((scripts) => {
        console.log('[Menubar] Received scripts update, count:', scripts.length);
        this.customScripts = scripts;
      }),
    );
    this.subscriptions.add(
      this.scriptService.isLoading$.subscribe((loading) => {
        console.log('[Menubar] Scripts loading state:', loading);
        this.customScriptsLoading = loading;
      }),
    );
    console.log('[Menubar] Requesting initial script list');
    void this.scriptService.list();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

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

  get recentCustomScripts() {
    return this.customScripts.slice(-3).reverse();
  }

  manageCustomScripts(): void {
    this.openCommandRunner('__manage_scripts__');
  }

  saveTargets() {
    console.log('Targets already saved in cookies');
  }
}
