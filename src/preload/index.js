/*import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}*/
const { contextBridge, ipcRenderer } = require('electron');
// Exponer ipcRenderer de manera segura al frontend
contextBridge.exposeInMainWorld('electron', {
  onNombrePC: (callback) => ipcRenderer.on('nombrePC', callback),
  onIplocal: (callback) => ipcRenderer.on('iplocal', callback),
  onUsername: (callback) => ipcRenderer.on('username', callback),
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  onUpdateReady: (callback) => ipcRenderer.on('update-ready', callback),
  instalarActualizacion: () => ipcRenderer.send('instalar-actualizacion')
});
