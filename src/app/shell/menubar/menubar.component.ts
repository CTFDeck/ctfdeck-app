import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';
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
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTriangleAlert } from '@ng-icons/lucide';
import { BrnMenuTrigger } from '@spartan-ng/brain/menu';
import { Subscription } from 'rxjs';
import { ScriptStore } from '../../domains/scripts/state/script.store';
import type { ToolCatalogItem } from '../../domains/tools/models/tool-catalog-item.model';
import { ToolCatalogStore } from '../../domains/tools/state/tool-catalog.store';
import { ThemeToggle } from './theme-toggle';
import type { MenubarCustomScript } from './menubar.models';
import { HlmIcon } from '@ctfdeck/helm/icon';
import { I18nLanguageSwitcherComponent } from './i18n-language-switcher.component';
import { TranslatePipe } from './translate.pipe';
import { ProjectsDialogHostComponent } from './components/projects/projects-dialog-host.component';
import { ProjectsMenuComponent } from './components/projects/projects-menu.component';
import { HlmTooltipImports } from '@ctfdeck/helm/tooltip';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
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
    HlmIcon,
    I18nLanguageSwitcherComponent,
    TranslatePipe,
    ProjectsMenuComponent,
    ProjectsDialogHostComponent,
    ...HlmTooltipImports,
  ],
  providers: [
    provideIcons({
      lucideTriangleAlert,
    }),
  ],
  templateUrl: './menubar.html',
  styleUrls: ['./menubar.css'],
})
export class MenubarComponent implements OnInit, OnDestroy {
  private readonly scriptStore = inject(ScriptStore);
  private readonly toolCatalogStore = inject(ToolCatalogStore);

  @Output() openTargetManagerEvent = new EventEmitter<'view' | 'add' | 'delete'>();
  @Output() openCommandRunnerEvent = new EventEmitter<string | undefined>();
  @Output() openMissingToolsEvent = new EventEmitter<void>();

  customScripts: MenubarCustomScript[] = [];
  customScriptsLoading = false;
  tools: ToolCatalogItem[] = [];

  private readonly subscriptions = new Subscription();

  ngOnInit(): void {
    this.subscriptions.add(
      this.scriptStore.scripts$.subscribe((scripts) => {
        this.customScripts = scripts;
      }),
    );

    this.subscriptions.add(
      this.scriptStore.isLoading$.subscribe((loading) => {
        this.customScriptsLoading = loading;
      }),
    );

    this.subscriptions.add(
      this.toolCatalogStore.tools$.subscribe((tools) => {
        this.tools = tools;
      }),
    );

    void this.scriptStore.list();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get hasMissingTools(): boolean {
    return this.tools.some((tool) => tool.kind === 'binary' && !tool.isInstalled);
  }

  get recentCustomScripts(): MenubarCustomScript[] {
    return this.customScripts.slice(-3).reverse();
  }

  openExternal(url: string): void {
    window.open(url, '_blank', 'noopener');
  }

  openTargetManager(mode: 'view' | 'add' | 'delete'): void {
    this.openTargetManagerEvent.emit(mode);
  }

  openCommandRunner(toolId?: string): void {
    this.openCommandRunnerEvent.emit(toolId);
  }

  openMissingTools(): void {
    this.openMissingToolsEvent.emit();
  }

  openTool(tool: ToolCatalogItem): void {
    if (tool.kind === 'externalWebApp' && tool.externalUrl) {
      this.openExternal(tool.externalUrl);
      return;
    }

    this.openCommandRunner(tool.id);
  }

  getToolsByCategory(category: string): ToolCatalogItem[] {
    return this.tools.filter((tool) => tool.category === category);
  }

  hasToolsInCategory(category: string): boolean {
    return this.tools.some((tool) => tool.category === category);
  }

  manageCustomScripts(): void {
    this.openCommandRunner('__manage_scripts__');
  }

  openUrl(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
