import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, effect, inject } from '@angular/core';
import { BrnDialogContent, BrnDialogImports, BrnDialogTrigger } from '@spartan-ng/brain/dialog';
import { HlmDialogImports } from '@ctfdeck/helm/dialog';
import { provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronRight,
  lucideDownload,
  lucideLayoutGrid,
  lucidePlus,
  lucideUpload,
} from '@ng-icons/lucide';
import { ExportProjectsDialogComponent } from './dialogs/export-projects-dialog.component';
import { ImportProjectsDialogComponent } from './dialogs/import-projects-dialog.component';
import { NewProjectDialogComponent } from './dialogs/new-project-dialog.component';
import { ProjectsUiService } from './projects-ui.service';

@Component({
  selector: 'ctf-projects-dialog-host',
  standalone: true,
  imports: [
    CommonModule,
    ...BrnDialogImports,
    ...HlmDialogImports,
    BrnDialogContent,
    BrnDialogTrigger,
    NewProjectDialogComponent,
    ImportProjectsDialogComponent,
    ExportProjectsDialogComponent,
  ],
  providers: [
    provideIcons({
      lucidePlus,
      lucideLayoutGrid,
      lucideUpload,
      lucideChevronRight,
      lucideChevronDown,
      lucideDownload,
    }),
  ],
  templateUrl: './projects-dialog-host.component.html',
})
export class ProjectsDialogHostComponent {
  private readonly projectsUi = inject(ProjectsUiService);

  @ViewChild('newProjectTrigger') newProjectTrigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('importProjectsTrigger') importProjectsTrigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('exportProjectsTrigger') exportProjectsTrigger?: ElementRef<HTMLButtonElement>;

  constructor() {
    effect(() => {
      const dialog = this.projectsUi.activeDialog();
      if (!dialog) {
        return;
      }

      setTimeout(() => {
        if (dialog === 'new') {
          this.newProjectTrigger?.nativeElement.click();
          return;
        }

        if (dialog === 'import') {
          this.importProjectsTrigger?.nativeElement.click();
          return;
        }

        this.exportProjectsTrigger?.nativeElement.click();
      });
    });
  }

  isSingleExportMode(): boolean {
    return this.projectsUi.exportDialogMode() === 'single';
  }
}
