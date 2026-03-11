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
import { CommonModule } from '@angular/common';
import { ScriptService } from '../../app/core/services/script.service';
import { Subscription } from 'rxjs';
import { ToolCatalogService } from '../../app/core/services/tool-catalog.service';
import { ToolCatalogItem } from '../../app/core/services/websocket.protocol';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTriangleAlert } from '@ng-icons/lucide';

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
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucideTriangleAlert,
    }),
  ],
  templateUrl: './menubar.html',
  styleUrls: ['./menubar.css'],
})
export class Menubar implements OnInit, OnDestroy {
  constructor(
    private router: Router,
    private scriptService: ScriptService,
    private toolCatalogService: ToolCatalogService,
  ) {}

  @Output() openTargetManagerEvent = new EventEmitter<'view' | 'add' | 'delete'>();
  @Output() openCommandRunnerEvent = new EventEmitter<string | undefined>();
  @Output() openMissingToolsEvent = new EventEmitter<void>();

  customScripts: Array<{ id: string; name: string; category: number; template: string }> = [];
  customScriptsLoading = false;
  tools: ToolCatalogItem[] = [];

  private subscriptions = new Subscription();

  ngOnInit(): void {
    this.subscriptions.add(
      this.scriptService.scripts$.subscribe((scripts) => {
        this.customScripts = scripts;
      }),
    );

    this.subscriptions.add(
      this.scriptService.isLoading$.subscribe((loading) => {
        this.customScriptsLoading = loading;
      }),
    );

    this.subscriptions.add(
      this.toolCatalogService.tools$.subscribe((tools) => {
        this.tools = tools;
      }),
    );

    void this.scriptService.list();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get hasMissingTools(): boolean {
    return this.tools.some((t) => t.kind === 'binary' && !t.isInstalled);
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
    this.openCommandRunnerEvent.emit(toolId);
  }

  openMissingTools(): void {
    this.openMissingToolsEvent.emit();
  }

  openTool(tool: ToolCatalogItem) {
    if (tool.kind === 'externalWebApp' && tool.externalUrl) {
      this.openExternal(tool.externalUrl);
      return;
    }

    this.openCommandRunner(tool.id);
  }

  getToolsByCategory(category: string) {
    return this.tools.filter((t) => t.category === category);
  }

  hasToolsInCategory(category: string): boolean {
    return this.tools.some((t) => t.category === category);
  }

  get recentCustomScripts() {
    return this.customScripts.slice(-3).reverse();
  }

  manageCustomScripts(): void {
    this.openCommandRunner('__manage_scripts__');
  }

  saveTargets() {
  }
}
