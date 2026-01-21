import { Routes } from '@angular/router';

import { TerminalComponent } from '../ui/terminal/terminal.component';

export const routes: Routes = [
  { path: 'terminal', component: TerminalComponent },
  { path: '', redirectTo: 'terminal', pathMatch: 'full' },
];
