type LogMessageFunction = (message: string, ...args: unknown[]) => void;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type Logger = {
    [K in LogLevel]: LogMessageFunction
}

const loggerMap = new Map<string, Logger>();

const isDev = import.meta.env.DEV;

function getLogMessage(level: LogLevel, name: string, message: string): string {
    return `[${level.toUpperCase()}] [${name}] ${message}`;
}

export function getLogger(name: string): Logger {
    let logger = loggerMap.get(name);
    if (logger === undefined) {
        logger = {
            debug: (message: string, ...args: unknown[]) => {
                if (isDev) {
                    console.debug(getLogMessage('debug', name, message), ...args);
                }
            },
            info: (message: string, ...args: unknown[]) => console.info(getLogMessage('info', name, message), ...args),
            warn: (message: string, ...args: unknown[]) => console.warn(getLogMessage('warn', name, message), ...args),
            error: (message: string, ...args: unknown[]) => console.error(getLogMessage('error', name, message), ...args),
        };
        loggerMap.set(name, logger);
    }
    return logger;
}