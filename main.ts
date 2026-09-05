import { app, BrowserWindow, protocol, screen, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { registerMediaIpc } from './ipc/mediaIpc';
import { registerEngineIpc } from './ipc/engineIpc';
import { registerExportIpc } from './ipc/exportIpc';
import { registerMediaProtocol } from './ipc/mediaProtocol';
import { initTempFileManagerHooks, cleanupStaleTempFiles, cleanupAllTrackedTempFiles } from './tempFileManager';

// Hardware acceleration & decoder flags
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      bypassCSP: true,
      stream: true,
    },
  },
]);

export let mainWindow: BrowserWindow | null = null;

export const getDefaultOutputDirectory = (): string => {
  let defaultDir: string;
  try {
    const videosPath = app.getPath('videos');
    defaultDir = path.join(videosPath, 'TrimBinOutput');
  } catch {
    defaultDir = path.join(os.homedir(), 'Movies', 'TrimBinOutput');
  }

  if (!fs.existsSync(defaultDir)) {
    try {
      fs.mkdirSync(defaultDir, { recursive: true });
    } catch (err) {
      console.error('Error creating default output directory:', err);
    }
  }
  return defaultDir;
};

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
  isFullScreen: boolean;
}

const getWindowStateFilePath = (): string => {
  return path.join(app.getPath('userData'), 'window-state.json');
};

const loadWindowState = (): WindowState => {
  const defaultState: WindowState = {
    width: 1240,
    height: 880,
    isMaximized: false,
    isFullScreen: false,
  };

  try {
    const filePath = getWindowStateFilePath();
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      if (data.x !== undefined && data.y !== undefined && data.width && data.height) {
        const displays = screen.getAllDisplays();
        const isVisible = displays.some((display) => {
          const { x, y, width, height } = display.bounds;
          return (
            data.x >= x - 100 &&
            data.x <= x + width - 100 &&
            data.y >= y - 100 &&
            data.y <= y + height - 100
          );
        });

        if (isVisible) {
          return {
            ...defaultState,
            ...data,
          };
        }
      }

      return {
        ...defaultState,
        isMaximized: data.isMaximized || false,
        isFullScreen: data.isFullScreen || false,
      };
    }
  } catch (err) {
    console.warn('Failed to load window state:', err);
  }
  return defaultState;
};

const saveWindowState = (win: BrowserWindow) => {
  try {
    if (win.isDestroyed()) return;

    const isFullScreen = win.isFullScreen();
    const isMaximized = win.isMaximized();
    const bounds = win.getBounds();
    const filePath = getWindowStateFilePath();

    const state: WindowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized,
      isFullScreen,
    };

    if (fs.existsSync(filePath)) {
      try {
        const prev = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (isMaximized || isFullScreen) {
          state.x = prev.x;
          state.y = prev.y;
          state.width = prev.width || bounds.width;
          state.height = prev.height || bounds.height;
        }
      } catch {}
    }

    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to save window state:', err);
  }
};

function buildAppMenu(): Menu {
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(process.platform === 'darwin'
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    },
  ];

  return Menu.buildFromTemplate(menuTemplate);
}

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'icon.png');
  const iconFile = fs.existsSync(iconPath) ? iconPath : path.join(app.getAppPath(), 'icon.png');
  const windowState = loadWindowState();

  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    title: 'TrimBin',
    icon: iconFile,
    width: windowState.width,
    height: windowState.height,
    minWidth: 850,
    minHeight: 650,
    backgroundColor: '#09090b',
    show: false,
    webPreferences: {
      preload: fs.existsSync(path.join(__dirname, 'preload.js'))
        ? path.join(__dirname, 'preload.js')
        : fs.existsSync(path.join(__dirname, 'dist', 'preload.js'))
        ? path.join(__dirname, 'dist', 'preload.js')
        : path.join(__dirname, '..', 'dist', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false,
      webSecurity: true,
    },
  };

  if (windowState.x !== undefined && windowState.y !== undefined) {
    windowOptions.x = windowState.x;
    windowOptions.y = windowState.y;
  }

  mainWindow = new BrowserWindow(windowOptions);
  mainWindow.webContents.on('console-message', (_event, _level, message) => {
    console.log('[Renderer]', message);
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isReload =
      (input.key.toLowerCase() === 'r' && (input.meta || input.control)) ||
      input.key === 'F5';

    const isDevTools =
      input.key === 'F12' ||
      ((input.meta || input.control) && input.shift && ['i', 'j', 'c'].includes(input.key.toLowerCase())) ||
      ((input.meta || input.control) && input.alt && input.key.toLowerCase() === 'i');

    if (isReload || isDevTools) {
      event.preventDefault();
    }
  });

  Menu.setApplicationMenu(buildAppMenu());

  if (process.platform === 'darwin' && app.dock && fs.existsSync(iconFile)) {
    try {
      app.dock.setIcon(iconFile);
    } catch (e) {
      console.warn('Could not set dock icon:', e);
    }
  }

  if (windowState.isFullScreen) {
    mainWindow.setFullScreen(true);
  } else if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  let stateSaveTimer: NodeJS.Timeout | null = null;
  const triggerSaveState = () => {
    if (stateSaveTimer) clearTimeout(stateSaveTimer);
    stateSaveTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        saveWindowState(mainWindow);
      }
    }, 250);
  };

  mainWindow.on('resize', triggerSaveState);
  mainWindow.on('move', triggerSaveState);
  mainWindow.on('maximize', triggerSaveState);
  mainWindow.on('unmaximize', triggerSaveState);
  mainWindow.on('enter-full-screen', triggerSaveState);
  mainWindow.on('leave-full-screen', triggerSaveState);
  mainWindow.on('close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      saveWindowState(mainWindow);
    }
  });

  const possiblePaths = [
    path.join(__dirname, '..', 'frontend', 'dist', 'renderer', 'index.html'),
    path.join(app.getAppPath(), 'frontend', 'dist', 'renderer', 'index.html'),
    path.join(__dirname, 'renderer', 'index.html'),
  ];
  const productionIndexPath = possiblePaths.find((p) => fs.existsSync(p)) || possiblePaths[0];

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL).catch(() => {
      if (fs.existsSync(productionIndexPath)) {
        mainWindow?.loadFile(productionIndexPath);
      }
    });
  } else if (fs.existsSync(productionIndexPath)) {
    mainWindow.loadFile(productionIndexPath);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers Registration
registerMediaIpc({
  getMainWindow: () => mainWindow,
  getDefaultOutputDir: getDefaultOutputDirectory,
});

registerEngineIpc({
  getMainWindow: () => mainWindow,
  getDefaultOutputDir: getDefaultOutputDirectory,
});

registerExportIpc({
  getDefaultOutputDir: getDefaultOutputDirectory,
});

// App Lifecycle
app.whenReady().then(() => {
  initTempFileManagerHooks();
  cleanupStaleTempFiles();
  registerMediaProtocol();
  getDefaultOutputDirectory();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  cleanupAllTrackedTempFiles();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
