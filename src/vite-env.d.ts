/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_MESSAGING_TRANSPORT?: 'signalr' | 'websocket';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
