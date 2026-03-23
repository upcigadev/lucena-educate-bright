/// <reference types="vite/client" />

declare global {
  interface Window {
    electronAPI: {
      login: (cpf: string, password: string) => Promise<{success: boolean, user?: any}>;
      createStudent: (data: { name: string; matricula: string; class_id?: string; guardian_id?: string }) => Promise<{success: boolean, id?: string, error?: string}>;
      enrollUserDevice: (params: { ip: string; id: string; name: string; matricula: string }) => Promise<{success: boolean, error?: string}>;
      getSchools: () => Promise<{success: boolean, data?: any[], error?: string}>;
      createSchool: (data: { name: string }) => Promise<{success: boolean, data?: any, error?: string}>;
      getClasses: (schoolId?: string) => Promise<{success: boolean, data?: any[], error?: string}>;
      createClass: (data: { name: string; school_id: string }) => Promise<{success: boolean, data?: any, error?: string}>;
      getUsersByRole: (role: string) => Promise<{success: boolean, data?: any[], error?: string}>;
      createUser: (data: { cpf: string; name: string; password?: string; role: string }) => Promise<{success: boolean, data?: any, error?: string}>;
      onDeviceWebhook: (callback: (payload: any) => void) => void;
    };
  }
}
