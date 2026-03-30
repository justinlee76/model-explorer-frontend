class UrlHelper {
    baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    getUrl(path: string, query?: { [key: string]: string | string[] }): string {
        const url = new URL(path, this.baseUrl);
        if (query !== undefined) {
            for (const [key, value] of Object.entries(query)) {
                if (Array.isArray(value))
                    value.forEach(v => url.searchParams.append(key, v));
                else
                    url.searchParams.set(key, value);
            }
        }
        return url.href;
    }
}

const urlHelper = new UrlHelper(import.meta.env.VITE_API_URL);

export function getUrl(path: string, query?: { [key: string]: string | string[] }): string {
    return urlHelper.getUrl(path, query);
}

export async function fetchJsonData<T>(url: string, signal?: AbortSignal, requestData?: unknown, method: string = 'GET'): Promise<T> {
    const options: RequestInit = {
        method,
        signal
    };
    if (requestData !== undefined && method !== 'GET') {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(requestData);
    }
    console.log('fetch', url, options);
    const response = await fetch(url, options);
    if (!response.ok)
        throw new Error(`HTTP error ${response.status}`);
    const data = await response.json()
    console.log(`fetch response from ${url}`, data);
    return data;
}