import { contextBridge as r, ipcRenderer as o } from "electron";
r.exposeInMainWorld("electronAPI", {
  login: (e, t) => o.invoke("auth:login", e, t),
  getStudents: () => o.invoke("db:getStudents"),
  createStudent: (e) => o.invoke("db:createStudent", e),
  enrollUserDevice: (e) => o.invoke("device:enrollUser", e),
  getSchools: () => o.invoke("db:getSchools"),
  createSchool: (e) => o.invoke("db:createSchool", e),
  getClasses: (e) => o.invoke("db:getClasses", e),
  createClass: (e) => o.invoke("db:createClass", e),
  getUsersByRole: (e) => o.invoke("db:getUsersByRole", e),
  createUser: (e) => o.invoke("db:createUser", e),
  onDeviceWebhook: (e) => {
    const t = (s, n) => e(n);
    return o.on("device:webhook", t), () => o.removeListener("device:webhook", t);
  }
});
