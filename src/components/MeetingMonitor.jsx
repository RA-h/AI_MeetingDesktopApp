// src/components/MeetingMonitor.jsx
import { useEffect, useState } from 'react';

function extractTranscriptText(payload) {
    if (!payload) return '';

    // Recall.ai / Desktop SDK callback shape: payload.data.words[]
    // Neatly formats JSON to extract only spoken words
    if (payload.data?.words && Array.isArray(payload.data.words)) {
        const speaker =
            payload.data.participant?.name ||
            `Speaker ${payload.data.participant?.id ?? '?'}`;

        const words = payload.data.words
            .map((w) => w.text)
            .filter(Boolean)
            .join(' ');

        return `${speaker}: ${words}`;
    }

    // Fallbacks (if they ever change the structure later)
    if (typeof payload.text === 'string') return payload.text;
    if (typeof payload.transcript === 'string') return payload.transcript;

    // Deepgram-style: { channel: { alternatives: [{ transcript }] } }
    const alt =
        payload.alternatives?.[0] ??
        payload.channel?.alternatives?.[0];

    if (alt && typeof alt.transcript === 'string') {
        return alt.transcript;
    }

    return JSON.stringify(payload);
}

export default function MeetingMonitor() {
    const [lastMeetingEvent, setLastMeetingEvent] = useState(null);
    const [permissionsGranted, setPermissionsGranted] = useState(false);

    const [finalTranscript, setFinalTranscript] = useState('');
    const [partialTranscript, setPartialTranscript] = useState('');

    useEffect(() => {
        if (!window.recall) {
            console.warn(
                'window.recall is not defined – check preload.js / BrowserWindow config'
            );
            return;
        }

        const {
            onPermissionsGranted,
            onMeetingDetected,
            onTranscriptPartial,
            onTranscriptFinal,
        } = window.recall;

        // macOS permissions (no-op on Windows if never fired)
        onPermissionsGranted?.((evt) => {
            console.log('[Renderer] permissions-granted', evt);
            setPermissionsGranted(true);
        });

        // Meeting detection
        onMeetingDetected?.((evt) => {
            console.log('[Renderer] meeting-detected', evt);
            setLastMeetingEvent(evt);
        });

        // Partial transcripts (live line)
        onTranscriptPartial?.((payload) => {
            const text = extractTranscriptText(payload);
            console.log('[Renderer] partial transcript:', text);
            setPartialTranscript(text);
        });

        // Final transcripts (append)
        onTranscriptFinal?.((payload) => {
            const text = extractTranscriptText(payload);
            console.log('[Renderer] final transcript:', text);

            setFinalTranscript((prev) =>
                prev ? `${prev.trim()} ${text}` : text
            );
            setPartialTranscript('');
        });

        // No cleanup needed since we didn't set up explicit unsubscribers
    }, []);

    return (
        <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
            <h1>Meeting AI Desktop App</h1>

            <p>
                Recall SDK status:{' '}
                <strong>
                    {permissionsGranted
                        ? 'Permissions granted'
                        : 'Waiting for permissions / meeting'}
                </strong>
            </p>

            <h2>Last detected meeting</h2>
            {lastMeetingEvent ? (
                <pre
                    style={{
                        background: '#111',
                        color: '#0f0',
                        padding: 12,
                        borderRadius: 8,
                        maxHeight: 200,
                        overflow: 'auto',
                        fontSize: 12,
                    }}
                >
          {JSON.stringify(lastMeetingEvent, null, 2)}
        </pre>
            ) : (
                <p>No meeting detected yet.</p>
            )}

            <h2 style={{ marginTop: 24 }}>Live Transcript</h2>

            <div
                style={{
                    background: '#f3f3f3',
                    padding: 12,
                    borderRadius: 8,
                    minHeight: 120,
                    border: '1px solid #ddd',
                    whiteSpace: 'pre-wrap',
                }}
            >
                {finalTranscript || partialTranscript ? (
                    <>
                        {finalTranscript && (
                            <div style={{ marginBottom: 8 }}>{finalTranscript}</div>
                        )}
                        {partialTranscript && (
                            <div style={{ opacity: 0.6 }}>
                                {partialTranscript}
                                <span className="cursor">▌</span>
                            </div>
                        )}
                    </>
                ) : (
                    <span style={{ opacity: 0.6 }}>No transcript yet…</span>
                )}
            </div>
        </div>
    );
}

