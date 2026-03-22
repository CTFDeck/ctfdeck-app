import { Component, signal, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MenubarComponent } from './shell/menubar/menubar.component';
import { WorkspaceSidebarComponent } from './shell/sidebar/workspace-sidebar.component';
import { TargetManagerComponent } from './domains/targets/ui/target-manager.component';
import { CommandRunnerComponent } from './domains/command-runner/ui/command-runner.component';
import { HlmToaster } from '@ctfdeck/helm/sonner';
import { SudoPasswordModalComponent } from './shell/sudo-password-modal/sudo-password-modal.component';
import { ToolInstallModalComponent } from './domains/tools/ui/tool-install-modal/tool-install-modal.component';
import { TranslatePipe } from './shell/menubar/translate.pipe';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MenubarComponent,
    WorkspaceSidebarComponent,
    TargetManagerComponent,
    CommandRunnerComponent,
    HlmToaster,
    SudoPasswordModalComponent,
    ToolInstallModalComponent,
    TranslatePipe,
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class App {
  protected readonly title = signal('CTFDeck-app');

  targetManagerVisible = false;
  targetManagerMode: 'view' | 'add' | 'delete' = 'view';
  commandRunnerVisible = false;
  selectedToolId = '';

  @ViewChild('targetManager', { static: false }) targetManager?: TargetManagerComponent;

  openTargetManager(mode: 'view' | 'add' | 'delete') {
    this.targetManagerMode = mode;
    this.targetManagerVisible = true;

    setTimeout(() => {
      if (this.targetManager) {
        this.targetManager.open(this.targetManagerMode);
      }
    }, 0);
  }

  closeTargetManager() {
    this.targetManagerVisible = false;
  }

  openCommandRunner(toolId?: string) {
    this.selectedToolId = toolId || '';
    this.commandRunnerVisible = true;
  }

  closeCommandRunner() {
    this.commandRunnerVisible = false;
  }
}
