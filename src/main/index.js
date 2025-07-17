const { app, BrowserWindow, ipcMain, protocol, Tray, Menu, powerMonitor, Notification } = require('electron');
const path = require('path');
const { join } = require('path');
const { electronApp, optimizer, is } = require('@electron-toolkit/utils');
const os = require('os');
const axios = require('axios');

// Configuración general
app.setAppUserModelId('SAYMA Checador');
const iconPath = path.resolve(__dirname, '../../resources/icon_tray.ico');
let tray;
let mainWindow;

// Protocolos necesarios
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'http',
    privileges: {
      standard: true,
      bypassCSP: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  },
  {
    scheme: 'https',
    privileges: {
      standard: true,
      bypassCSP: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  },
  {
    scheme: 'mailto',
    privileges: { standard: true }
  }
]);

// IP local
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

// Crear ventana
const createWindow = () => {
  app.setName('Checador SAYMA');

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

  // Ocultar al cerrar
  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
    mainWindow.setSkipTaskbar(true);
    if (process.platform === 'win32') {
      tray.displayBalloon({
        title: 'SAYMA',
        content: 'Tu app ha sido minimizada en la bandeja del sistema.',
        icon: path.resolve(__dirname, '../../resources/icon_tray.ico')
      });
      tray.setToolTip('Checador SAYMA');
    }
  });

  //mainWindow.webContents.openDevTools();

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Falló la carga de la ventana:', errorDescription);
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // Comunicación con render
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

function mostrarNotificacion(titulo, mensaje) {
  new Notification({
    title: titulo,
    body: mensaje,
    icon: path.resolve(__dirname, '../../resources/icon_tray.ico')
  }).show();
}

let notificacion1 = null;
let notificacion2 = null;

setInterval(() => {
  const ahora = new Date();
  const hora = ahora.getHours();
  const hoy = ahora.toDateString();

  if (hora === 13 && notificacion1 !== hoy) {
    mostrarNotificacion('¡Recordatorio!', 'Tu hora de comida está próxima!, no olvides checar tu hora de salida y entrada!');
    notificacion1 = hoy;
  } else {
    if (hora === 14 && notificacion2 !== hoy) {
      mostrarNotificacion('¡Recordatorio!', 'Tu hora de comida está próxima!, no olvides checar tu hora de salida y entrada!');
      notificacion2 = hoy;
    }
  }
}, 60000);

let estadoPantalla = 'active';

powerMonitor.on('lock-screen', () => (estadoPantalla = 'locked'));
powerMonitor.on('unlock-screen', () => (estadoPantalla = 'active'));
powerMonitor.on('suspend', () => (estadoPantalla = 'suspend'));
powerMonitor.on('resume', () => (estadoPantalla = 'active'));
powerMonitor.on('display-sleep', () => (estadoPantalla = 'display-sleep'));
powerMonitor.on('display-wake', () => (estadoPantalla = 'active'));

// App lista
app.whenReady().then(() => {
  createWindow();

  // Monitoreo de actividad
  setInterval(async () => {
    const idleTime = powerMonitor.getSystemIdleTime();

    let estado = 'active';

    if (estadoPantalla === 'locked') estado = 'locked';
    else if (estadoPantalla === 'suspend') estado = 'suspend';
    else if (estadoPantalla === 'display-sleep') estado = 'screen-off';
    else {
      if (idleTime >= 60 && idleTime < 300) estado = 'idle';
      else if (idleTime >= 300) estado = 'away';
    }

    axios
      .post('https://intranet.saymagroup.com/api/actividad', {
        estado,
        inactivo_segundos: idleTime,
        fecha: new Date().toISOString(),
        nombrePC,
        username,
        iplocal
      })
      .catch((err) => {
        console.error('Error enviando estado de actividad:', err.message);
      });
  }, 600000);

  // Tray / bandeja del sistema
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mostrar',
      click: () => {
        mainWindow.show();
        mainWindow.setSkipTaskbar(false);
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

// Cierra completamente excepto en macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

const { autoUpdater } = require('electron-updater');

app.whenReady().then(() => {
  autoUpdater.checkForUpdates();
});

autoUpdater.on('update-available', () => {
  mostrarNotificacion('🟢 Actualización disponible.', 'Actualización disponible. Descargando...');
});

autoUpdater.on('update-downloaded', () => {
  mostrarNotificacion('✅ Actualización descargada.', 'Se aplicará al reiniciar.');
  mainWindow.webContents.send('update-ready');
});

ipcMain.on('instalar-actualizacion', () => {
  mostrarNotificacion('🔁 Instalando actualización...', 'Espera mientras terminamos...');
  autoUpdater.quitAndInstall();
});
