import { Component, signal, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Menubar } from '../ui/menubar/menubar';
import { ChatSidebar } from '../ui/sidebar/chat-sidebar';
import { TargetManagerComponent } from '../ui/target-manager/target-manager.component';
import { HlmToaster } from '@ctfdeck/helm/sonner';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    RouterOutlet, 
    Menubar, 
    ChatSidebar, 
    TargetManagerComponent,
    HlmToaster
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class App {
  protected readonly title = signal('CTFDeck-app');
  
  targetManagerVisible = false;
  targetManagerMode: 'view' | 'add' | 'delete' = 'view';
  
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

  saveTargets() {
    console.log('Targets already saved in cookies');
  }
}