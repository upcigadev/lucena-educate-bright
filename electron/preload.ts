import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  login: (cpf: string, password: string) => ipcRenderer.invoke('auth:login', cpf, password),
  onDeviceWebhook: (callback: (data: any) => void) => {
    const subscription = (event: any, data: any) => callback(data);
    ipcRenderer.on('device:webhook', subscription);
    return () => ipcRenderer.removeListener('device:webhook', subscription);
  }
});

declare global {
  interface Window {
    electronAPI: {
      login: (cpf: string, password: string) => Promise<any>;
      onDeviceWebhook: (callback: (data: any) => void) => () => void;
    };
  }
}
