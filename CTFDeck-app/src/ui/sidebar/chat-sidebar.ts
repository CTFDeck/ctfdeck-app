import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HlmButtonImports } from '@ctfdeck/helm/button';
import { HlmSidebarImports } from '@ctfdeck/helm/sidebar';
import { HlmScrollAreaImports } from '@ctfdeck/helm/scroll-area';

@Component({
  selector: 'ctf-chat-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, HlmSidebarImports, HlmButtonImports, HlmScrollAreaImports],
  templateUrl: './chat-sidebar.html',
  styleUrls: ['./chat-sidebar.css'],
})
export class ChatSidebar {
  search = '';

  projects = [
    { id: 'p1', name: 'Personal' },
    { id: 'p2', name: 'Work' },
  ];

  chats = [
    { id: 'c1', title: 'Research notes about X' },
    { id: 'c2', title: 'Bug hunting session' },
    { id: 'c3', title: 'CTF writeups' },
  ];

  newChat() {
    const id = `c${Date.now()}`;
    this.chats.unshift({ id, title: 'New chat' });
  }

  openChat(chat: { id: string; title: string }) {
    // placeholder: replace with router navigation or open chat in main area
    console.log('Open chat', chat);
  }

  get filteredChats() {
    const term = this.search?.toLowerCase().trim();
    if (!term) return this.chats;
    return this.chats.filter((c) => c.title.toLowerCase().includes(term));
  }
}
