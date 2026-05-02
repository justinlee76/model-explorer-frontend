import { getLogger } from './logging';

const logger = getLogger('dataUtils');

const baseUrl = import.meta.env.VITE_API_URL;

export function getUrl(path: string, query?: { [key: string]: string }): string {
    const url = new URL(path, baseUrl);
    if (query !== undefined) {
        for (const [key, value] of Object.entries(query)) {
            url.searchParams.set(key, value);
        }
    }
    return url.href;
}

export async function fetchJsonData<T>(url: string, signal?: AbortSignal, method: string = 'GET', requestData?: unknown): Promise<T> {
    const options: RequestInit = {
        method,
        signal
    };
    if (requestData !== undefined && method !== 'GET') {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(requestData);
    }
    logger.debug('fetch', url, options);
    const response = await fetch(url, options);
    if (!response.ok)
        throw new Error(`HTTP error ${response.status}`);
    if (response.status === 204)
        return null as T;
    const data = await response.json() as T;
    logger.debug(`fetch response from ${url}`, data);
    return data;
}

export const handleFetchError = (error: unknown) => {
    if (!(error instanceof Error && error.name === 'AbortError'))
        logger.error('fetch error', error);
};

export function createWebSocket(url: string, onmessage: (event: MessageEvent) => void): { socket: WebSocket | null, promise: Promise<void> } {
    let socket: WebSocket | null = null;
    const promise = new Promise<void>((resolve, reject) => {
        socket = new WebSocket(url);

        socket.onopen = () => {
            logger.debug('ws open');
            resolve();
        };

        socket.onmessage = onmessage;

        socket.onclose = () => {
            logger.debug('ws closed');
        };

        socket.onerror = (error) => {
            logger.error('ws error', error);
            reject(error);
        };
    });

    return { socket, promise };
}