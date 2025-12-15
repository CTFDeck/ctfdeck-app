import { Component, signal, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HlmButtonImports } from '@ctfdeck/helm/button';
import { HlmSidebarImports } from '@ctfdeck/helm/sidebar';
import { HlmScrollAreaImports } from '@ctfdeck/helm/scroll-area';
import { HlmInputGroupImports } from '@ctfdeck/helm/input-group';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucidePlus,
  lucideArrowUp,
  lucideCheck,
  lucideMessageCircleDashed,
  lucideFolder,
  lucidePanelLeft,
} from '@ng-icons/lucide';

@Component({
  selector: 'ctf-chat-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgIcon,
    HlmSidebarImports,
    HlmButtonImports,
    HlmScrollAreaImports,
    HlmInputGroupImports,
  ],
  providers: [
    provideIcons({
      lucideSearch,
      lucidePlus,
      lucideArrowUp,
      lucideCheck,
      lucideMessageCircleDashed,
      lucideFolder,
      lucidePanelLeft,
    }),
  ],

  templateUrl: './chat-sidebar.html',
  styleUrls: ['./chat-sidebar.css'],
})
export class ChatSidebar {
  isCollapsed = signal(false);

  @HostBinding('class.w-64')
  get expanded() {
    return !this.isCollapsed();
  }

  @HostBinding('class.w-16') // 4rem = 64px
  get collapsed() {
    return this.isCollapsed();
  }

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

  /** Number of results currently shown by the search filter */
  get resultsCount(): number {
    return this.filteredChats.length;
  }

  toggleSidebar() {
    this.isCollapsed.set(!this.isCollapsed());
  }
}
