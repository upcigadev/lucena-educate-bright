import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  login: (cpf: string, password: string) => ipcRenderer.invoke('auth:login', cpf, password),
  createStudent: (data: any) => ipcRenderer.invoke('db:createStudent', data),
  enrollUserDevice: (params: any) => ipcRenderer.invoke('device:enrollUser', params),
  getSchools: () => ipcRenderer.invoke('db:getSchools'),
  createSchool: (data: any) => ipcRenderer.invoke('db:createSchool', data),
  getClasses: (schoolId?: string) => ipcRenderer.invoke('db:getClasses', schoolId),
  createClass: (data: any) => ipcRenderer.invoke('db:createClass', data),
  getUsersByRole: (role: string) => ipcRenderer.invoke('db:getUsersByRole', role),
  createUser: (data: any) => ipcRenderer.invoke('db:createUser', data),
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
