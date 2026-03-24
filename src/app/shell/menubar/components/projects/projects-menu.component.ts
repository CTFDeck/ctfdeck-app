import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { HlmMenuGroup, HlmMenuItem, HlmMenuSeparator } from '@ctfdeck/helm/menu';
import { ProjectsUiService } from './projects-ui.service';
import { TranslatePipe } from '../../translate.pipe';

@Component({
  selector: 'ctf-projects-menu',
  standalone: true,
  imports: [CommonModule, HlmMenuGroup, HlmMenuItem, HlmMenuSeparator, TranslatePipe],
  templateUrl: './projects-menu.component.html',
})
export class ProjectsMenuComponent {
  protected readonly projectsUi = inject(ProjectsUiService);
}
