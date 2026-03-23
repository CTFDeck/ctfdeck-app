import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButtonImports } from '@ctfdeck/helm/button';
import { HlmCheckboxImports } from '@ctfdeck/helm/checkbox';
import { HlmDialogImports } from '@ctfdeck/helm/dialog';
import { HlmInputImports } from '@ctfdeck/helm/input';
import { HlmLabelImports } from '@ctfdeck/helm/label';
import { HlmTableImports } from '@ctfdeck/helm/table';
import { NgIcon } from '@ng-icons/core';
import { ProjectMetadata } from '../../../../../domains/projects/models/project.model';
import { ProjectsUiService } from '../projects-ui.service';
import { TranslatePipe } from '../../../translate.pipe';

@Component({
  selector: 'ctf-export-projects-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ...HlmDialogImports,
    ...HlmButtonImports,
    ...HlmCheckboxImports,
    ...HlmInputImports,
    ...HlmLabelImports,
    ...HlmTableImports,
    NgIcon,
    TranslatePipe,
  ],
  templateUrl: './export-projects-dialog.component.html',
})
export class ExportProjectsDialogComponent {
  protected readonly projectsUi = inject(ProjectsUiService);

  @Input({ required: true }) dialogCtx!: { close: () => void };

  readonly sortedProjectsForExport$ = this.projectsUi.sortedProjectsForExport$;

  get singleExportDraft() {
    return this.projectsUi.exportDraft();
  }

  set singleExportDraft(next: {
    projectId: string;
    filename: string;
    options: { history: boolean; targets: boolean; writeups: boolean; media: boolean; scripts: boolean };
  }) {
    this.projectsUi.updateExportDraft(next);
  }

  get globalExportDraft() {
    return this.projectsUi.globalExportDraft();
  }

  set globalExportDraft(next: {
    suffix: string;
    options: { history: boolean; targets: boolean; writeups: boolean; media: boolean; scripts: boolean };
  }) {
    this.projectsUi.updateGlobalExportDraft(next);
  }

  isSingleMode(): boolean {
    return this.projectsUi.exportDialogMode() === 'single';
  }

  isSelected(projectId: string): boolean {
    return this.projectsUi.exportSelection().has(projectId);
  }

  projectIds(projects: ProjectMetadata[]): string[] {
    return this.projectsUi.projectIds(projects);
  }

  toggleProjectSelection(projectId: string): void {
    this.projectsUi.toggleProjectSelection(projectId);
  }

  toggleAllProjectSelections(projectIds: string[]): void {
    this.projectsUi.toggleAllProjectSelections(projectIds);
  }

  areAllProjectSelectionsSelected(projectIds: string[]): boolean {
    return this.projectsUi.areAllProjectSelectionsSelected(projectIds);
  }

  async confirmExport(): Promise<void> {
    if (this.isSingleMode()) {
      this.dialogCtx.close();
      await this.projectsUi.confirmSingleExport();
      return;
    }

    if (this.projectsUi.exportSelection().size === 0) {
      return;
    }

    this.dialogCtx.close();
    await this.projectsUi.confirmGlobalExport();
  }
}
