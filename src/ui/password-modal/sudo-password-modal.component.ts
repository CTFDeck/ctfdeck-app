import { Component, signal } from '@angular/core';
import { AsyncPipe, NgIf } from '@angular/common';
import { SudoPasswordModalService } from '../../app/core/services/sudo-password-modal.service';

@Component({
  selector: 'ctfdeck-sudo-password-modal',
  standalone: true,
  imports: [NgIf, AsyncPipe],
  templateUrl: './sudo-password-modal.component.html',
  styleUrls: ['./sudo-password-modal.component.css'],
})
export class SudoPasswordModalComponent {
  password = signal('');

  constructor(public modal: SudoPasswordModalService) {}

  submit() {
    this.modal.submit(this.password());
    this.password.set('');
  }

  cancel() {
    this.modal.cancel();
    this.password.set('');
  }
}
