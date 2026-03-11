import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucidePlus,
  lucideArrowUp,
  lucideCheck,
  lucideMessageCircleDashed,
  lucidePanelLeft,
  lucidePencil,
  lucideTrash2,
  lucideFileText,
  lucideFolderOpen,
  lucideServer,
  lucideEye,
  lucideEdit,
  lucideSave,
  lucideImage,
  lucideVideo,
  lucideChevronLeft,
} from '@ng-icons/lucide';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withHashLocation()),
    provideIcons({
      lucideSearch,
      lucidePlus,
      lucideArrowUp,
      lucideCheck,
      lucideMessageCircleDashed,
      lucidePanelLeft,
      lucidePencil,
      lucideTrash2,
      lucideFileText,
      lucideFolderOpen,
      lucideServer,
      lucideEye,
      lucideEdit,
      lucideSave,
      lucideImage,
      lucideVideo,
      lucideChevronLeft,
    }),
  ],
};
