// src/server.js
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const RECALL_API_KEY = process.env.RECALL_API_KEY;
const RECALL_REGION = process.env.RECALL_REGION || 'us-west-2';
const RECALL_BASE_URL = `https://${RECALL_REGION}.recall.ai`;

if (!RECALL_API_KEY) {
    console.warn('[Backend] RECALL_API_KEY is not set in .env');
}

// Create an SDK upload for the Desktop SDK recording
app.post('/api/create_sdk_recording', async (req, res) => {
    try {
        // We ignore any metadata from the client for now to avoid
        // "metadata values must be strings" errors.
        const payload = {
            metadata: {}, // keep it empty & simple for now

            recording_config: {
                transcript: {
                    provider: {
                        deepgram_streaming: {
                            model: 'nova-3',
                            language: 'en',
                            smart_format: true,
                            diarize: true, // enable speaker detection
                        },
                    },
                },
                realtime_endpoints: [
                    {
                        type: 'desktop_sdk_callback',
                        events: [
                            'transcript.data',
                            'transcript.partial_data',
                        ],
                    },
                ],
            },
        };

        const url = `${RECALL_BASE_URL}/api/v1/sdk_upload/`;
        console.log('[Backend] POST', url);
        console.log('[Backend] Sending sdk_upload payload:', payload);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                Authorization: `Token ${RECALL_API_KEY}`,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(
                '[Backend] Failed to create sdk_upload:',
                response.status,
                text,
            );
            return res
                .status(500)
                .json({ error: 'Failed to create sdk_upload', details: text });
        }

        const data = await response.json();
        // { id, upload_token, ... }
        return res.json(data);
    } catch (err) {
        console.error('[Backend] Error in /api/create_sdk_recording:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Simple status page if you open http://localhost:4000 in a browser
app.get('/', (req, res) => {
    res.send(`
    <html>
      <head>
        <title>Meeting AI Backend</title>
        <style>
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            margin: 0;
            padding: 40px;
            background: #111;
            color: #eee;
          }
          .box {
            background: #1c1c1c;
            padding: 30px;
            border-radius: 12px;
            max-width: 600px;
            border: 1px solid #333;
          }
          code {
            background: #222;
            padding: 4px 8px;
            border-radius: 6px;
            color: #9cf;
          }
        </style>
      </head>
      <body>
        <h1>🧠 Meeting AI Backend</h1>
        <div class="box">
          <p>Status: <strong style="color: #4ae;">Online</strong></p>
          <p>Recall Region: <code>${RECALL_REGION}</code></p>
          <p>Available Endpoints:</p>
          <ul>
            <li><code>POST /api/create_sdk_recording</code></li>
          </ul>
        </div>
      </body>
    </html>
  `);
});

const PORT = process.env.BACKEND_PORT || 4000;
app.listen(PORT, () => {
    console.log(`[Backend] Listening on http://localhost:${PORT}`);
    console.log('[Backend] Using Recall base URL:', RECALL_BASE_URL);
});


