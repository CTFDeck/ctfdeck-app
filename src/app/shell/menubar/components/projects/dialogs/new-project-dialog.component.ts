import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButtonImports } from '@ctfdeck/helm/button';
import { HlmDialogImports } from '@ctfdeck/helm/dialog';
import { HlmInputImports } from '@ctfdeck/helm/input';
import { HlmLabelImports } from '@ctfdeck/helm/label';
import { NgIcon } from '@ng-icons/core';
import { ProjectsUiService } from '../projects-ui.service';
import { TranslatePipe } from '../../../translate.pipe';

@Component({
  selector: 'ctf-new-project-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ...HlmDialogImports,
    ...HlmLabelImports,
    ...HlmInputImports,
    ...HlmButtonImports,
    NgIcon,
    TranslatePipe,
  ],
  templateUrl: './new-project-dialog.component.html',
})
export class NewProjectDialogComponent {
  private readonly projectsUi = inject(ProjectsUiService);

  @Input({ required: true }) dialogCtx!: { close: () => void };

  get draft() {
    return this.projectsUi.createProjectDraft();
  }

  set draft(next: { name: string; description: string }) {
    this.projectsUi.updateCreateProjectDraft(next);
  }

  async createProject(): Promise<void> {
    const name = this.projectsUi.createProjectDraft().name.trim();
    if (!name) {
      return;
    }

    this.dialogCtx.close();
    await this.projectsUi.createProject();
  }
}
