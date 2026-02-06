import { Directive } from '@angular/core';
import { HlmButton } from '@ctfdeck/helm/button';

@Directive({
	selector: 'button[hlmAlertDialogAction]',
	hostDirectives: [{ directive: HlmButton, inputs: ['variant', 'size'] }],
})
export class HlmAlertDialogActionButton {}
