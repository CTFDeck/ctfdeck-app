import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Add API functions here
  // sendMessage: (message: string) => ipcRenderer.send('message', message),
});
