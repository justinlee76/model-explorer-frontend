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
    const data = await response.json()
    logger.debug(`fetch response from ${url}`, data);
    return data;
}

export const handleFetchError = (error: unknown) => {
    if (!(error instanceof Error && error.name === 'AbortError'))
        logger.error('fetch error', error);
};

