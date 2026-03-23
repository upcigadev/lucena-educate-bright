import { contextBridge as n, ipcRenderer as o } from "electron";
n.exposeInMainWorld("electronAPI", {
  login: (e, r) => o.invoke("auth:login", e, r),
  createStudent: (e) => o.invoke("db:createStudent", e),
  enrollUserDevice: (e) => o.invoke("device:enrollUser", e),
  getSchools: () => o.invoke("db:getSchools"),
  createSchool: (e) => o.invoke("db:createSchool", e),
  getClasses: (e) => o.invoke("db:getClasses", e),
  createClass: (e) => o.invoke("db:createClass", e),
  getUsersByRole: (e) => o.invoke("db:getUsersByRole", e),
  createUser: (e) => o.invoke("db:createUser", e),
  onDeviceWebhook: (e) => {
    const r = (s, t) => e(t);
    return o.on("device:webhook", r), () => o.removeListener("device:webhook", r);
  }
});
