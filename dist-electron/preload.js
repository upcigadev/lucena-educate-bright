import { contextBridge as r, ipcRenderer as n } from "electron";
r.exposeInMainWorld("electronAPI", {
  login: (o, e) => n.invoke("auth:login", o, e),
  onDeviceWebhook: (o) => {
    const e = (t, i) => o(i);
    return n.on("device:webhook", e), () => n.removeListener("device:webhook", e);
  }
});
