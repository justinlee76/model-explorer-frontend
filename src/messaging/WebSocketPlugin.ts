import { getLogger, type Logger } from '@/logging';
import { getUrl } from '@/dataUtils';
import type { Job, JobLogMessage, MetricHistoryKey, MetricHistoryValue, Model } from '@/types';
import type { JobsChangeNotifier, JobsMessageHandlers, MessagingPlugin, ModelsChangeNotifier, ModelsMessageHandlers } from './messaging.types';

class WebSocketMessagingClient<TIn, TOut> {
    protected logger: Logger;
    private ws: WebSocket | null = null;

    constructor() {
        this.logger = getLogger(this.constructor.name);
    }

    createWebSocket(url: string, handler: (message: TIn) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                this.logger.debug('ws open');
                resolve();
            };

            this.ws.onmessage = (event) => {
                this.logger.debug('ws message', event);
                try {
                    handler(JSON.parse(event.data));
                } catch (error) {
                    this.logger.error('error processing ws message', error);
                }
            };

            this.ws.onclose = () => {
                this.logger.debug('ws closed');
            };

            this.ws.onerror = (error) => {
                this.logger.error('ws error', error);
                reject(error);
            };
        });
    }

    sendMessage(message: TOut): boolean {
        if (this.ws?.readyState !== WebSocket.OPEN) {
            this.logger.warn('Unable to send message as open socket not available');
            return false;
        }

        try {
            this.logger.debug('sending message over ws', message);
            this.ws.send(JSON.stringify(message));
            return true;
        } catch (error) {
            this.logger.error('error sending message', error);
            return false;
        }
    }

    cleanup(): Promise<void> {
        this.ws?.close();
        this.ws = null;
        return Promise.resolve();
    }
}

interface TagRequest {
    type: 'tag.subscribe' | 'tag.unsubscribe';
    tag: string;
}

interface MetricHistoryRequest {
    type: 'metric-history.subscribe' | 'metric-history.unsubscribe';
    keys: MetricHistoryKey[];
}

interface MetricHistoryUpdate extends MetricHistoryValue {
    type: 'metric-history.update';
}

interface ModelInsertOrUpdate {
    type: 'model.insert' | 'model.update';
    model: Model;
}

interface ModelDelete {
    type: 'model.delete';
    id: string;
}

type ModelChangeMessage = ModelInsertOrUpdate | MetricHistoryUpdate | ModelDelete;

type ModelRequest = TagRequest | MetricHistoryRequest;

class WebSocketModelsChangeNotifier extends WebSocketMessagingClient<ModelChangeMessage, ModelRequest> implements ModelsChangeNotifier {
    private handlers: ModelsMessageHandlers;

    constructor(handlers: ModelsMessageHandlers) {
        super();
        this.handlers = handlers;
    }

    start(): Promise<void> {
        return this.createWebSocket(getUrl('ws/models').replace(/^http/, 'ws'), (message) => {
            switch (message.type) {
                case 'metric-history.update': {
                    const { id, metricName, index, value } = message;
                    this.handlers.onUpdateMetricHistory({ id, metricName, index, value });
                    break;
                }
                case 'model.insert': {
                    const { model } = message;
                    this.handlers.onInsert(model);
                    break;
                }
                case 'model.update': {
                    const { model } = message;
                    this.handlers.onUpdate(model);
                    break;
                }
                case 'model.delete': {
                    const { id } = message;
                    this.handlers.onDelete(id);
                    break;
                }
            }
        });
    }
    subscribeTag(tag: string): void {
        this.sendMessage({ type: 'tag.subscribe', tag });
    }

    unsubscribeTag(tag: string): void {
        this.sendMessage({ type: 'tag.unsubscribe', tag });
    }

    subscribeMetricHistory(keys: MetricHistoryKey[]): void {
        this.sendMessage({ type: 'metric-history.subscribe', keys });
    }

    unsubscribeMetricHistory(keys: MetricHistoryKey[]): void {
        this.sendMessage({ type: 'metric-history.unsubscribe', keys });
    }
}

interface JobInsertOrUpdate {
    type: 'job.insert' | 'job.update';
    job: Job;
}

interface JobDelete {
    type: 'job.delete';
    id: string;
}

interface JobLogsRequest {
    type: 'job.messages.subscribe' | 'job.messages.unsubscribe';
    id: string;
}

interface JobLogsUpdate extends JobLogMessage {
    type: 'job.messages.update';
}

type JobChangeMessage = JobInsertOrUpdate | JobDelete | JobLogsUpdate;

class WebSocketJobsChangeNotifier extends WebSocketMessagingClient<JobChangeMessage, JobLogsRequest> implements JobsChangeNotifier {
    private handlers: JobsMessageHandlers;

    constructor (handlers: JobsMessageHandlers) {
        super();
        this.handlers = handlers;
    }
    start(): Promise<void> {
        return this.createWebSocket(getUrl('ws/jobs').replace(/^http/, 'ws'), (message) => {
            switch (message.type) {
                case 'job.insert': {
                    const { job } = message;
                    this.handlers.onInsert(job);
                    break;
                }
                case 'job.update': {
                    const { job } = message;
                    this.handlers.onUpdate(job);
                    break;
                }
                case 'job.delete': {
                    const { id } = message;
                    this.handlers.onDelete(id);
                    break;
                }
                case 'job.messages.update': {
                    const { id, index, message: logMessage } = message;
                    this.handlers.onUpdateLogs({ id, index, message: logMessage });
                    break;
                }
            }
        });
    }
    
    subscribeJob(id: string): void {
        this.sendMessage({ type: 'job.messages.subscribe', id });
    }

    unsubscribeJob(id: string): void {
        this.sendMessage({ type: 'job.messages.unsubscribe', id });
    }
}

export class WebSocketPlugin implements MessagingPlugin {
    getModelsChangeNotifier(handlers: ModelsMessageHandlers): ModelsChangeNotifier {
        return new WebSocketModelsChangeNotifier(handlers);
    }
    getJobsChangeNotifier(handlers: JobsMessageHandlers): JobsChangeNotifier {
        return new WebSocketJobsChangeNotifier(handlers);
    }
}