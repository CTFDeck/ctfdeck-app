import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Menubar } from '../ui/menubar/menubar';
import { ChatSidebar } from '../ui/sidebar/chat-sidebar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Menubar, ChatSidebar],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class App {
  protected readonly title = signal('CTFDeck-app');
}
