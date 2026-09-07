// Preload runs in an isolated context. The ERP talks to the cloud API over
// HTTPS via the global fetch shim, so no Node bridge is required. Keep this
// minimal and secure — expose only what the renderer truly needs.
import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("gssDesktop", {
  platform: process.platform,
  versions: { electron: process.versions.electron, chrome: process.versions.chrome }
});
