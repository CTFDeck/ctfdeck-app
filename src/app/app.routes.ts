import { Routes } from '@angular/router';

import { TerminalComponent } from './domains/terminal/ui/terminal-panel/terminal.component';
import { WriteUpEditorComponent } from './domains/writeups/ui/writeup-editor.component';

export const routes: Routes = [
  { path: 'terminal', component: TerminalComponent },
  { path: 'writeup/:id', component: WriteUpEditorComponent },
  { path: '', redirectTo: 'terminal', pathMatch: 'full' },
];
