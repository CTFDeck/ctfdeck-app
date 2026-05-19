import { CommonModule } from '@angular/common';
import { Component, Input, inject, signal } from '@angular/core';
import { HlmButtonImports } from '@ctfdeck/helm/button';
import { HlmDialogImports } from '@ctfdeck/helm/dialog';
import { HlmCheckboxImports } from '@ctfdeck/helm/checkbox';
import { HlmLabelImports } from '@ctfdeck/helm/label';
import { HlmTableImports } from '@ctfdeck/helm/table';
import { HlmScrollAreaImports } from '@ctfdeck/helm/scroll-area';
import { NgIcon } from '@ng-icons/core';
import { ProjectExportMetadata } from '../../../../../domains/projects/infrastructure/project.websocket.protocol';
import { ProjectsUiService } from '../projects-ui.service';
import { TranslatePipe } from '../../../translate.pipe';

@Component({
  selector: 'ctf-import-projects-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ...HlmDialogImports,
    ...HlmButtonImports,
    ...HlmLabelImports,
    ...HlmCheckboxImports,
    ...HlmTableImports,
    ...HlmScrollAreaImports,
    NgIcon,
    TranslatePipe,
  ],
  templateUrl: './import-projects-dialog.component.html',
})
export class ImportProjectsDialogComponent {
  protected readonly projectsUi = inject(ProjectsUiService);

  @Input({ required: true }) dialogCtx!: { close: () => void };

  readonly showImported = signal(false);

  readonly groupedExports$ = this.projectsUi.groupedExports$;

  isSelected(filename: string): boolean {
    return this.projectsUi.importSelection().has(filename);
  }

  toggleExportSelection(filename: string): void {
    this.projectsUi.toggleImportSelection(filename);
  }

  toggleAllExports(exports: ProjectExportMetadata[]): void {
    this.projectsUi.toggleAllImports(exports);
  }

  areAllSelected(exports: ProjectExportMetadata[]): boolean {
    return this.projectsUi.areAllImportsSelected(exports);
  }

  formatSize(bytes: number): string {
    return this.projectsUi.formatSize(bytes);
  }

  async confirmImport(): Promise<void> {
    if (this.projectsUi.importSelection().size === 0) {
      return;
    }

    this.dialogCtx.close();
    await this.projectsUi.confirmImport();
  }
}
