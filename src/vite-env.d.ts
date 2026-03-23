/// <reference types="vite/client" />

declare global {
  interface Window {
    electronAPI: {
      login: (cpf: string, password: string) => Promise<{success: boolean, user?: any}>;
      createStudent: (data: { name: string; matricula: string; class_id?: string; guardian_id?: string }) => Promise<{success: boolean, id?: string, error?: string}>;
      enrollUserDevice: (params: { ip: string; id: string; name: string; matricula: string }) => Promise<{success: boolean, error?: string}>;
      onDeviceWebhook: (callback: (payload: any) => void) => void;
    };
  }
}
