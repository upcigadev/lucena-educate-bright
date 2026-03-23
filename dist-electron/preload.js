import { contextBridge as i, ipcRenderer as o } from "electron";
i.exposeInMainWorld("electronAPI", {
  login: (e, n) => o.invoke("auth:login", e, n),
  createStudent: (e) => o.invoke("db:createStudent", e),
  enrollUserDevice: (e) => o.invoke("device:enrollUser", e),
  onDeviceWebhook: (e) => {
    const n = (t, r) => e(r);
    return o.on("device:webhook", n), () => o.removeListener("device:webhook", n);
  }
});
