import { Directive } from '@angular/core';
import { HlmButton, provideBrnButtonConfig } from '@ctfdeck/helm/button';

@Directive({
	selector: 'button[hlmAlertDialogCancel]',
	providers: [provideBrnButtonConfig({ variant: 'outline' })],
	hostDirectives: [{ directive: HlmButton, inputs: ['variant', 'size'] }],
})
export class HlmAlertDialogCancelButton {}
