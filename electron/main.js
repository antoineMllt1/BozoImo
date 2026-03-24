const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');

const isDev = !app.isPackaged;
const PORT = 5000;

// ── Start Express backend ──────────────────────────────────────────────────────
// In production, tell backend/main.js to also serve frontend/dist as static files
if (!isDev) {
  process.env.ELECTRON_STATIC = 'true';
}
process.env.PORT = PORT;

require(path.join(app.getAppPath(), 'backend', 'main.js'));

// ── Wait for server to be ready ────────────────────────────────────────────────
function waitForServer(port, retries = 25) {
  return new Promise((resolve) => {
    const attempt = (n) => {
      http.get(`http://localhost:${port}`, resolve)
        .on('error', () => {
          if (n > 0) setTimeout(() => attempt(n - 1), 300);
          else resolve(); // give up waiting, try loading anyway
        });
    };
    attempt(retries);
  });
}

// ── Create window ──────────────────────────────────────────────────────────────
async function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    title: 'Estimia',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const url = isDev
    ? 'http://localhost:5173'   // Vite dev server
    : `http://localhost:${PORT}`; // Express serves frontend/dist

  await waitForServer(isDev ? 5173 : PORT);
  await win.loadURL(url);
  win.show();

  win.on('closed', () => win.destroy());
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
