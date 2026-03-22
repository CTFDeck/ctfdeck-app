import { AsyncPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { HlmButtonImports } from '@ctfdeck/helm/button';
import { HlmInputImports } from '@ctfdeck/helm/input';
import { HlmLabelImports } from '@ctfdeck/helm/label';
import { SudoPasswordModalStore } from './sudo-password-modal.store';
import { TranslatePipe } from '../menubar/translate.pipe';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'ctfdeck-sudo-password-modal',
  standalone: true,
  imports: [AsyncPipe, ...HlmButtonImports, ...HlmInputImports, ...HlmLabelImports, TranslatePipe],
  templateUrl: './sudo-password-modal.component.html',
  styleUrls: ['./sudo-password-modal.component.css'],
})
export class SudoPasswordModalComponent {
  readonly password = signal('');
  readonly modal = inject(SudoPasswordModalStore);

  submit(): void {
    const password = this.password();
    this.password.set('');
    this.modal.submit(password);
  }

  cancel(): void {
    this.password.set('');
    this.modal.cancel();
  }
}
