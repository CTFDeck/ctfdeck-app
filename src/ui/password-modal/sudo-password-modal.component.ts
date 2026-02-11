import { Component, signal, inject } from '@angular/core';
import { AsyncPipe, NgIf } from '@angular/common';
import { SudoPasswordModalService } from '../../app/core/services/sudo-password-modal.service';

import { HlmButtonImports } from '@ctfdeck/helm/button';
import { HlmInputImports } from '@ctfdeck/helm/input';
import { HlmLabelImports } from '@ctfdeck/helm/label';

@Component({
  selector: 'ctfdeck-sudo-password-modal',
  standalone: true,
  imports: [NgIf, AsyncPipe, ...HlmButtonImports, ...HlmInputImports, ...HlmLabelImports],
  templateUrl: './sudo-password-modal.component.html',
  styleUrls: ['./sudo-password-modal.component.css'],
})
export class SudoPasswordModalComponent {
  password = signal('');
  readonly modal = inject(SudoPasswordModalService);

  submit() {
    const pwd = this.password();
    this.password.set('');
    this.modal.submit(pwd);
  }

  cancel() {
    this.password.set('');
    this.modal.cancel();
  }
}
