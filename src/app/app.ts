import { Component, signal, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Menubar } from '../ui/menubar/menubar';
import { ChatSidebar } from '../ui/sidebar/chat-sidebar';
import { TargetManagerComponent } from '../ui/target-manager/target-manager.component';
import { CommandRunnerComponent } from '../ui/command-runner/command-runner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, Menubar, ChatSidebar, TargetManagerComponent, CommandRunnerComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class App {
  protected readonly title = signal('CTFDeck-app');
  
  targetManagerVisible = false;
  targetManagerMode: 'view' | 'add' | 'delete' = 'view';
  commandRunnerVisible = false;
  selectedToolId: string = '';
  
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

  saveTargets() {
    console.log('Targets already saved in cookies');
  }
}