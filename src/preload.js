// src/preload.js
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('recall', {
    // macOS permissions granted
    onPermissionsGranted(callback) {
        ipcRenderer.on('recall:permissions-granted', (_event, payload) => {
            callback(payload);
        });
    },

    // Meeting detected
    onMeetingDetected(callback) {
        ipcRenderer.on('recall:meeting-detected', (_event, payload) => {
            callback(payload);
        });
    },

    // Deepgram partial transcript (interim)
    onTranscriptPartial(callback) {
        ipcRenderer.on('recall:transcript-partial', (_event, payload) => {
            callback(payload);
        });
    },

    // Deepgram final transcript (utterances)
    onTranscriptFinal(callback) {
        ipcRenderer.on('recall:transcript-final', (_event, payload) => {
            callback(payload);
        });
    },
});



