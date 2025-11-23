import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import RecallAiSdk from '@recallai/desktop-sdk';

let mainWindow;
let currentUploadId = null;
let currentRecordingActive = false;

// Handle Squirrel installer events
if (started) {
  app.quit();
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  mainWindow.webContents.openDevTools();
};

// -------------------------------------------------------------
// Initialize Recall.ai Desktop SDK
// -------------------------------------------------------------
async function initRecallSdk() {
  await RecallAiSdk.init({
    apiUrl: 'https://us-west-2.recall.ai',
  });

  console.log('[Recall] SDK initialized');

  // macOS-only permissions
  if (process.platform === 'darwin') {
    RecallAiSdk.requestPermission('accessibility');
    RecallAiSdk.requestPermission('microphone');
    RecallAiSdk.requestPermission('screen-capture');

    RecallAiSdk.addEventListener('permission-status', (evt) =>
        console.log('[Recall] permission-status:', evt)
    );

    RecallAiSdk.addEventListener('permissions-granted', (evt) => {
      console.log('[Recall] permissions-granted:', evt);
      if (mainWindow) {
        mainWindow.webContents.send('recall:permissions-granted', evt);
      }
    });
  }

  // -------------------------------------------------------------
  // MEETING DETECTED → Request upload token → Start Recording
  // -------------------------------------------------------------
  RecallAiSdk.addEventListener('meeting-detected', async (evt) => {
    console.log('[Recall] meeting-detected', evt);

    if (mainWindow) {
      mainWindow.webContents.send('recall:meeting-detected', evt);
    }

    try {
      const res = await fetch('http://localhost:4000/api/create_sdk_recording', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          meeting_metadata: {
            platform: evt.window.platform,
            detected_at: new Date().toISOString(),
          },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('[Recall] backend /create_sdk_recording failed:', text);
        return;
      }

      const payload = await res.json();
      const uploadToken = payload.upload_token;
      currentUploadId = payload.id;

      console.log('[Recall] Received upload_token:', uploadToken);

      await RecallAiSdk.startRecording({
        windowId: evt.window.id,
        uploadToken,
      });

      currentRecordingActive = true;
      console.log('[Recall] Recording started');
    } catch (err) {
      console.error(
          '[Recall] Error creating SDK upload or starting recording:',
          err
      );
    }
  });

  // -------------------------------------------------------------
  // REALTIME TRANSCRIPTION FOR DEEPGRAM
  // -------------------------------------------------------------
  RecallAiSdk.addEventListener('realtime-event', (evt) => {
    if (!mainWindow) return;

    // Deepgram final transcript
    if (evt.event === 'transcript.data') {
      console.log('[Recall] Final transcript:', evt.data);
      mainWindow.webContents.send('recall:transcript-final', evt.data);
    }

    // Deepgram partial transcript
    if (evt.event === 'transcript.partial_data') {
      console.log('[Recall] Partial transcript:', evt.data);
      mainWindow.webContents.send('recall:transcript-partial', evt.data);
    }
  });
}

// -------------------------------------------------------------
app.whenReady().then(async () => {
  try {
    await initRecallSdk();
  } catch (err) {
    console.error('[Recall] Failed to init SDK:', err);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit on close (except macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

