/// <reference types="vite/client" />

declare global {
  interface Window {
    electronAPI: {
      login: (cpf: string, password: string) => Promise<{success: boolean, user?: any}>;
      onDeviceWebhook: (callback: (payload: any) => void) => void;
    };
  }
}
