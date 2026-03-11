import { computed, Directive, input } from '@angular/core';
import { hlm } from '@ctfdeck/helm/utils';
import { ClassValue } from 'clsx';

@Directive({
	selector: '[hlmDialogHeader],hlm-dialog-header',
	host: {
		'data-slot': 'dialog-header',
		'[class]': '_computedClass()',
	},
})
export class HlmDialogHeader {
	public readonly userClass = input<ClassValue>('', { alias: 'class' });
	protected readonly _computedClass = computed(() =>
		hlm('flex flex-col gap-2 text-center sm:text-start', this.userClass()),
	);
}
