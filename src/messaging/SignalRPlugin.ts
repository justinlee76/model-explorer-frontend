import { getLogger, type Logger } from '@/logging';
import { getUrl } from '@/dataUtils';
import type { Job, MetricHistoryKey, MetricHistoryValue, Model } from '@/types';
import type { HubConnection } from '@microsoft/signalr';
import type {
    JobsChangeNotifier,
    JobsMessageHandlers,
    MessagingPlugin,
    ModelsChangeNotifier,
    ModelsMessageHandlers
} from './messaging.types';

class SignalRMessagingClient {
    protected logger: Logger;
    private connection: HubConnection | null = null;
    private connectionVersion = 0;
    private startPromise: Promise<void> = Promise.resolve();

    constructor() {
        this.logger = getLogger(this.constructor.name);
    }

    protected createHubConnection(url: string, registerHandlers: (connection: HubConnection) => void): Promise<void> {
        const connectionVersion = ++this.connectionVersion;
        this.startPromise = this.startConnection(connectionVersion, url, registerHandlers);
        return this.startPromise;
    }

    private async startConnection(
        connectionVersion: number,
        url: string,
        registerHandlers: (connection: HubConnection) => void
    ): Promise<void> {
        const signalR = await import('@microsoft/signalr');
        if (this.connectionVersion !== connectionVersion)
            return;

        const connection = new signalR.HubConnectionBuilder()
            .withUrl(url)
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Information)
            .build();

        this.connection = connection;
        registerHandlers(connection);

        connection.onreconnecting(error => {
            this.logger.warn('signalr reconnecting', error);
        });

        connection.onreconnected(connectionId => {
            this.logger.info('signalr reconnected', connectionId);
            this.onReconnected();
        });

        connection.onclose(error => {
            if (error)
                this.logger.warn('signalr closed with error', error);
            else
                this.logger.debug('signalr closed');
        });

        try {
            await connection.start();
            if (this.connectionVersion !== connectionVersion) {
                await connection.stop();
                return;
            }
            this.logger.debug('signalr started');
        } catch (error) {
            if (this.connectionVersion === connectionVersion) {
                this.logger.error('error starting signalr connection', error);
                throw error;
            }
        }
    }

    protected invoke(method: string, ...args: unknown[]): void {
        this.startPromise
            .then(() => {
                const connection = this.connection;
                if (!connection) {
                    this.logger.warn(`unable to invoke ${method} without a signalr connection`);
                    return;
                }

                this.logger.debug('sending message over signalr', { method, args });
                return connection.invoke(method, ...args);
            })
            .catch(error => {
                this.logger.error(`error invoking signalr method ${method}`, error);
            });
    }

    protected logReceivedMessage(method: string, ...args: unknown[]): void {
        this.logger.debug('signalr message received', { method, args });
    }

    protected onReconnected(): void {
    }

    cleanup(): Promise<void> {
        this.connectionVersion++;
        const connection = this.connection;
        this.connection = null;

        if (!connection)
            return Promise.resolve();

        return connection.stop()
            .then(() => {
                this.logger.debug('signalr stopped');
            })
            .catch(error => {
                this.logger.error('error stopping signalr connection', error);
            });
    }
}

const metricHistoryKeyToString = ({ id, metricName }: MetricHistoryKey): string => JSON.stringify([id, metricName]);

class SignalRModelsChangeNotifier extends SignalRMessagingClient implements ModelsChangeNotifier {
    private handlers: ModelsMessageHandlers;
    private tags = new Set<string>();
    private metricHistorySubscriptions = new Map<string, MetricHistoryKey>();

    constructor(handlers: ModelsMessageHandlers) {
        super();
        this.handlers = handlers;
    }

    start(): Promise<void> {
        return this.createHubConnection(getUrl('/ModelDataHub'), connection => {
            connection.on('AddMetricData', (value: MetricHistoryValue) => {
                this.logReceivedMessage('AddMetricData', value);
                this.handlers.onUpdateMetricHistory(value);
            });

            connection.on('AddTrainingStats', (model: Model) => {
                this.logReceivedMessage('AddTrainingStats', model);
                this.handlers.onInsert(model);
            });

            connection.on('UpdateTrainingStats', (model: Model) => {
                this.logReceivedMessage('UpdateTrainingStats', model);
                this.handlers.onUpdate(model);
            });

            connection.on('RemoveTrainingStats', (id: string) => {
                this.logReceivedMessage('RemoveTrainingStats', id);
                this.handlers.onDelete(id);
            });
        });
    }

    subscribeTag(tag: string): void {
        this.tags.add(tag);
        this.invoke('MonitorTag', tag);
    }

    unsubscribeTag(tag: string): void {
        this.tags.delete(tag);
        this.invoke('EndMonitoring', tag);
    }

    subscribeMetricHistory(keys: MetricHistoryKey[]): void {
        if (keys.length === 0)
            return;

        keys.forEach(key => this.metricHistorySubscriptions.set(metricHistoryKeyToString(key), key));
        this.invoke('SubscribeAll', keys);
    }

    unsubscribeMetricHistory(keys: MetricHistoryKey[]): void {
        if (keys.length === 0)
            return;

        keys.forEach(key => this.metricHistorySubscriptions.delete(metricHistoryKeyToString(key)));
        this.invoke('UnsubscribeAll', keys);
    }

    protected override onReconnected(): void {
        this.tags.forEach(tag => this.invoke('MonitorTag', tag));

        const keys = [...this.metricHistorySubscriptions.values()];
        if (keys.length > 0)
            this.invoke('SubscribeAll', keys);
    }
}

class SignalRJobsChangeNotifier extends SignalRMessagingClient implements JobsChangeNotifier {
    private handlers: JobsMessageHandlers;
    private jobSubscriptions = new Set<string>();

    constructor(handlers: JobsMessageHandlers) {
        super();
        this.handlers = handlers;
    }

    start(): Promise<void> {
        return this.createHubConnection(getUrl('/JobHub'), connection => {
            connection.on('AddJob', (job: Job) => {
                this.logReceivedMessage('AddJob', job);
                this.handlers.onInsert(job);
            });

            connection.on('UpdateJob', (job: Job) => {
                this.logReceivedMessage('UpdateJob', job);
                this.handlers.onUpdate(job);
            });

            connection.on('RemoveJob', (id: string) => {
                this.logReceivedMessage('RemoveJob', id);
                this.handlers.onDelete(id);
            });

            connection.on('AddJobMessage', (id: string, index: number, message: string) => {
                this.logReceivedMessage('AddJobMessage', id, index, message);
                this.handlers.onUpdateLogs({ id, index, message });
            });
        });
    }

    subscribeJob(id: string): void {
        this.jobSubscriptions.add(id);
        this.invoke('Subscribe', id);
    }

    unsubscribeJob(id: string): void {
        this.jobSubscriptions.delete(id);
        this.invoke('Unsubscribe', id);
    }

    protected override onReconnected(): void {
        this.jobSubscriptions.forEach(id => this.invoke('Subscribe', id));
    }
}

export class SignalRPlugin implements MessagingPlugin {
    getModelsChangeNotifier(handlers: ModelsMessageHandlers): ModelsChangeNotifier {
        return new SignalRModelsChangeNotifier(handlers);
    }

    getJobsChangeNotifier(handlers: JobsMessageHandlers): JobsChangeNotifier {
        return new SignalRJobsChangeNotifier(handlers);
    }
}
