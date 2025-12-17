"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
// Add API functions here
// sendMessage: (message: string) => ipcRenderer.send('message', message),
});
//# sourceMappingURL=preload.js.map