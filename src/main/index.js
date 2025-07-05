const { app, BrowserWindow, ipcMain, protocol, Tray, Menu, powerMonitor } = require('electron');
const path = require('path');
const { join } = require('path');
const { electronApp, optimizer, is } = require('@electron-toolkit/utils');
const os = require('os');
const axios = require('axios');
app.setAppUserModelId('SAYMA Checador');
const iconPath = path.resolve(__dirname, '../../resources/icon_tray.ico');
let tray;
let mainWindow;

protocol.registerSchemesAsPrivileged([
  { scheme: 'http', privileges: { standard: true, bypassCSP: true, allowServiceWorkers: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
  { scheme: 'https', privileges: { standard: true, bypassCSP: true, allowServiceWorkers: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
  { scheme: 'mailto', privileges: { standard: true } },
]);

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}
const nombrePC = os.hostname();
const username = os.userInfo().username;
const iplocal = getLocalIP();

const createWindow = () => {
  app.setName('Checador SAYMA')
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    icon: join(__dirname, '../../build/icon.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // 👇 Ocultar en lugar de cerrar
  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
    mainWindow.setSkipTaskbar(true); // Oculta también de la barra de tareas
    if (process.platform === 'win32') {
      tray.displayBalloon({
        iconType: 'info',
        title: 'SAYMA',
        content: 'Tu app ha sido minimizada en la bandeja del sistema.',
        icon: path.resolve(__dirname, '../../resources/icon_tray_multi.ico')
      })
      tray.setToolTip('Checador SAYMA')
    }
  });

  // (opcional) para desarrollo
  mainWindow.webContents.openDevTools();

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Falló la carga de la ventana:', errorDescription);
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }



  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('nombrePC', nombrePC);
    mainWindow.webContents.send('username', username);
    mainWindow.webContents.send('iplocal', iplocal);

    ipcMain.removeHandler('set-checador');
    ipcMain.handle('set-checador', async (event, payload) => {
      try {
        const res = await axios.post('https://intranet.saymagroup.com/api/checador', payload);
        console.log(res.data);
        return res.data;
      } catch (error) {
        return { error: true, message: error.message };
      }
    });

    ipcMain.removeHandler('get-checador');
    ipcMain.handle('get-checador', async (event, payload) => {
      try {
        const res = await axios.post('https://intranet.saymagroup.com/api/getchecador', payload);
        console.log(res.data);
        return res.data;
      } catch (error) {
        return { error: true, message: error.message };
      }
    });
  });
};

app.whenReady().then(() => {
  createWindow();
  setInterval(async () => {
    const idleTime = powerMonitor.getSystemIdleTime(); // en segundos

    // Clasifica el estado según el tiempo de inactividad
    let estado = 'active';
    if (idleTime >= 60 && idleTime < 300) {
      estado = 'idle';
    } else if (idleTime >= 300) {
      estado = 'away';
    }

    // Mandar a backend
    axios.post('https://intranet.saymagroup.com/api/actividad-pc', {
      estado: estado, // 'active', 'idle', 'locked'
      inactivo_segundos: idleTime,
      fecha: new Date().toISOString(),
      nombrePC: nombrePC,
      username: username,
      iplocal: iplocal
    }).catch(err => {
      console.error('Error enviando estado de actividad:', err.message);
    });

  }, 60000); // cada 60s
  // Bandeja del sistema
  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mostrar',
      click: () => {
        mainWindow.show();
        mainWindow.setSkipTaskbar(false); // vuelve a mostrar en la barra de tareas
      }
    }
  ]);
  tray.setToolTip('Mi App');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.setSkipTaskbar(false);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Cierra solo si no es macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
