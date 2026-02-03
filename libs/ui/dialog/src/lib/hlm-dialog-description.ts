import { Directive } from '@angular/core';
import { BrnDialogDescription } from '@spartan-ng/brain/dialog';
import { classes } from '@ctfdeck/helm/utils';

@Directive({
	selector: '[hlmDialogDescription]',
	hostDirectives: [BrnDialogDescription],
	host: {
		'data-slot': 'dialog-description',
	},
})
export class HlmDialogDescription {
	constructor() {
		classes(() => 'text-muted-foreground text-sm');
	}
}
