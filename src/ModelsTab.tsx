import { useState, useEffect, type ChangeEvent, type ChangeEventHandler, useRef } from 'react';
import { ModelStatus, type Model } from './types';
import { ModelTable } from './ModelTable';
import { getUrl, fetchJsonData, handleFetchError } from './dataUtils';
import { MetricChart, type MetricChartData, type MetricChartDataSeries } from './MetricChart';
import type { ChartDataset } from 'chart.js';
import { Trash2 } from 'lucide-react';
import { ICON_SIZE, STROKE_WIDTH } from './constants';
import { getLogger } from './logging';

type MetricChartDataset = ChartDataset<'line', MetricChartDataSeries>;

interface MetricHistoryKey {
    id: string;
    metricName: string;
}

interface MetricHistory extends MetricHistoryKey {
    metricHistory: number[];
}

interface TagRequest {
    type: 'tag.subscribe' | 'tag.unsubscribe';
    tag: string;
}

interface ModelRequest {
    type: 'metric-history.subscribe' | 'metric-history.unsubscribe';
    keys: MetricHistoryKey[];
}

type ModelMessage = ModelInsertOrUpdate | MetricHistoryUpdate | ModelDelete;

interface ModelInsertOrUpdate {
    type: 'model.insert' | 'model.update';
    model: Model;
}

interface MetricHistoryUpdate {
    type: 'metric-history.update';
    id: string;
    metricName: string;
    index: number;
    value: number;
}

interface ModelDelete {
    type: 'model.delete';
    id: string;
}

interface DeleteModelsResponse {
    errors: { [id: string]: string };
}

const logger = getLogger('ModelsTab');

export function ModelsTab() {
    const [tags, setTags] = useState<string[]>([]);
    const [selectedTag, setSelectedTag] = useState('');
    const [models, setModels] = useState<Model[]>([]);
    const [selectedModels, setSelectedModels] = useState(new Set<string>());
    const [metrics, setMetrics] = useState<string[]>([]);
    const [selectedMetrics, setSelectedMetrics] = useState(new Set<string>());
    const [chartData, setChartData] = useState<MetricChartData>({ datasets: [] });
    const [activeModels, setActiveModels] = useState(new Set<string>());

    const selectedTagRef = useRef(selectedTag);

    const chartDataVersionRef = useRef(0);
    const datasetMapRef = useRef(new Map<string, MetricChartDataset>());
    const subscriptionsRef = useRef(new Set<string>());

    const socketRef = useRef<WebSocket | null>(null);

    const updateChartData = () => {
        setChartData(
            { datasets: [...datasetMapRef.current.values()] }
        );
    };

    const keyToString = (id: string, metricName: string): string => JSON.stringify({ id, metricName });
    const getMetricHistoryKey = (keyStr: string): MetricHistoryKey => JSON.parse(keyStr);

    const sendMessage = (message: ModelRequest | TagRequest): boolean => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            try {
                logger.debug('sending message over ws', message);
                socketRef.current.send(JSON.stringify(message));
                return true;
            } catch (error) {
                logger.error('error sending message', error);
            }
        }
        else
            logger.warn('Unable to send message as open socket not available');
        return false;
    };

    useEffect(() => {
        logger.debug('useEffect on []');

        const controller = new AbortController();

        const initWebSocket = (url: string, onOpen: () => void): WebSocket => {
            const ws = new WebSocket(url);

            ws.onopen = () => {
                logger.debug('ws open');
                onOpen();
            };

            ws.onmessage = (event) => {
                try {
                    logger.debug('received ws message', event.data);

                    const message = JSON.parse(event.data) as ModelMessage;
                    switch (message.type) {
                        case 'metric-history.update': {
                            const { id, metricName, index, value } = message;
                            const dataset = datasetMapRef.current.get(keyToString(id, metricName));
                            if (dataset !== undefined) {
                                dataset.data[index] = { x: index + 1, y: value };
                                updateChartData();
                            }
                            break;
                        }
                        case 'model.insert': {
                            const { model } = message;
                            if (model.tag === selectedTagRef.current) {
                                setModels(prev => [...prev, model]);
                                setSelectedModels(prev => new Set<string>([...prev, model.id]));
                                if (model.status === ModelStatus.Training)
                                    setActiveModels(prev => new Set<string>([...prev, model.id]));                           
                            }
                            break;
                        }
                        case 'model.update': {
                            const { model } = message;
                            if (model.tag === selectedTagRef.current) {
                                setModels(prev => prev.map(m => m.id === model.id ? model : m));
                                setActiveModels(prev => {
                                    if (model.status === ModelStatus.Training) {
                                        if (!prev.has(model.id))
                                            return new Set<string>([...prev, model.id]);
                                    }
                                    else if (prev.has(model.id))
                                        return new Set<string>([...prev].filter(m => m !== model.id));
                                    return prev;
                                });
                            }
                            break;
                        }
                        case 'model.delete': {
                            const { id } = message;
                            setModels(prev => prev.filter(m => m.id !== id));
                            setSelectedModels(prev => new Set<string>([...prev].filter(m => m !== id)));
                            setActiveModels(prev => prev.has(id) ? new Set<string>([...prev].filter(m => m !== id)) : prev);
                            break;
                        }
                    }
                } catch (error) {
                    logger.error('error processing ws message', error);
                }
            };

            ws.onclose = () => {
                logger.debug('ws closed');
            };

            ws.onerror = (error) => {
                logger.error('ws error', error);
            };

            return ws;
        };

        const loadData = () => {
            fetchJsonData<string[]>(getUrl('metric-names'), controller.signal)
                .then(data => {
                    setMetrics(data);
                    setSelectedMetrics(new Set(data));
                })
                .catch(handleFetchError);

            fetchJsonData<string[]>(getUrl('tags'), controller.signal)
                .then(data => {
                    setTags(data);
                    if (data.length > 0)
                        setSelectedTag(data[0]);
                })
                .catch(handleFetchError);            
        };

        const ws = initWebSocket(getUrl('ws').replace(/^http/, 'ws'), loadData);
        socketRef.current = ws;

        return () => {
            controller.abort();
            ws.close();
            socketRef.current = null;
        }
    }, []);

    useEffect(() => {
        logger.debug('useEffect on [selectedTag]');

        if (selectedTagRef.current !== '')
            sendMessage({ type: 'tag.unsubscribe', tag: selectedTagRef.current });

        if (selectedTag !== '')
            sendMessage({ type: 'tag.subscribe', tag: selectedTag });

        selectedTagRef.current = selectedTag;

        const controller = new AbortController();

        if (selectedTag !== '') {
            fetchJsonData<Model[]>(getUrl('models', { tag: selectedTag }), controller.signal)
                .then(data => {
                    setModels(data);
                    if (data.length > 0) {
                        const lastModel = data.reduce((last, current) => current.datetime > last.datetime ? current : last);
                        setSelectedModels(new Set<string>([lastModel.id]));
                    }
                    else
                        setSelectedModels(new Set<string>());
                    setActiveModels(new Set<string>(data.filter(m => m.status === ModelStatus.Training).map(m => m.id)));
                })
                .catch(handleFetchError);
        }

        return () => controller.abort();
    }, [selectedTag]);

    useEffect(() => {
        logger.debug('useEffect on [selectedModels, selectedMetrics, activeModels]');

        const setChanges = (current: Iterable<string>, previous: Iterable<string>): { added: string[], removed: string[] } => {
            const currentSet = current instanceof Set ? current : new Set(current);
            const previousSet = previous instanceof Set ? previous : new Set(previous);
            return {
                added: [...currentSet].filter(x => !previousSet.has(x)),
                removed: [...previousSet].filter(x => !currentSet.has(x))
            };
        };

        const toDataset = (history: MetricHistory): MetricChartDataset => ({
            label: `${history.id}: ${history.metricName}`,
            data: history.metricHistory.map((v, i) => ({ x: i + 1, y: v }))
        });

        const controller = new AbortController();

        const chartDataVersion = ++chartDataVersionRef.current;

        const selectedKeys = new Set<string>();
        const requiredSubscriptions = new Set<string>();
        for (const modelId of selectedModels) {
            const active = activeModels.has(modelId);
            for (const metricName of selectedMetrics) {
                const key = keyToString(modelId, metricName);
                selectedKeys.add(key);
                if (active)
                    requiredSubscriptions.add(key);
            }
        }

        const { added: addedSubscriptions, removed: removedSubscriptions } = setChanges(requiredSubscriptions, subscriptionsRef.current);

        if (removedSubscriptions.length > 0) {
            const message: ModelRequest = {
                type: 'metric-history.unsubscribe',
                keys: removedSubscriptions.map(getMetricHistoryKey)
            };
            sendMessage(message);
            removedSubscriptions.forEach(k => subscriptionsRef.current.delete(k));
        }

        if (addedSubscriptions.length > 0) {
            const message: ModelRequest = {
                type: 'metric-history.subscribe',
                keys: addedSubscriptions.map(getMetricHistoryKey)
            };
            sendMessage(message);
            addedSubscriptions.forEach(k => subscriptionsRef.current.add(k));
        }

        const { added: addedKeys, removed: removedKeys } = setChanges(selectedKeys, datasetMapRef.current.keys());

        if (removedKeys.length > 0) {            
            removedKeys.forEach(k => datasetMapRef.current.delete(k));
            updateChartData();
        }
        
        if (addedKeys.length > 0) {
            fetchJsonData<MetricHistory[]>(getUrl('metric-history'), controller.signal, 'POST', addedKeys.map(k => JSON.parse(k)))
                .then(data => {
                    if (chartDataVersion !== chartDataVersionRef.current)
                        return;

                    data.forEach(h => datasetMapRef.current.set(keyToString(h.id, h.metricName), toDataset(h)));
                    updateChartData();
                })
                .catch(handleFetchError);
        }

        return () => controller.abort();
    }, [selectedModels, selectedMetrics, activeModels]);

    const handleMetricCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
        setSelectedMetrics(prev => {
            const newMetrics = new Set<string>(prev);
            if (event.target.checked)
                newMetrics.add(event.target.value);
            else
                newMetrics.delete(event.target.value);
            return newMetrics;
        });
    };

    const handleTagChange = (event: ChangeEvent<HTMLSelectElement>) => {
        setSelectedTag(event.target.value);
    };

    const handleModelCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
        setSelectedModels(prev => {
            const newModels = new Set<string>(prev);
            if (event.target.checked)
                newModels.add(event.target.value);
            else
                newModels.delete(event.target.value);
            return newModels;
        });
    };

    const handleDeleteButtonClicked = () => {
        const msg = `Delete the following models?\n\n${[...selectedModels].join('\n')}`;
        if (confirm(msg)) {
            fetchJsonData<DeleteModelsResponse>(getUrl('delete-models'), undefined, 'POST', [...selectedModels].filter(m => !activeModels.has(m)))
                .then(data => {
                    if (Object.keys(data.errors).length > 0) {
                        const errors = Object.entries(data.errors).map(e => `${e[0]}: ${e[1]}`);
                        const errorMsg = `The following errors were encountered while deleting models:\n\n${errors.join('\n')}`;
                        alert(errorMsg);
                    }
                });
            const selectedActive = [...selectedModels].filter(m => activeModels.has(m));
            if (selectedActive.length > 0) {
                const alertMsg = `Unable to delete the following models as they are currently being trained:\n\n${selectedActive.join('\n')}`;
                alert(alertMsg);
            }
        }
    };

    return (
        <>
            <div>
                {metrics.map(m => <MetricCheckbox key={m} metricName={m} checked={selectedMetrics.has(m)} handleMetricCheckboxChange={handleMetricCheckboxChange} />)}
            </div>
            <MetricChart data={chartData} />
            <div>
                <label htmlFor="tagDropdown">Tag</label>
                <select id="tagDropdown" value={selectedTag} onChange={handleTagChange}>
                    {tags.map(tag =>
                        <option key={tag} value={tag}>{tag}</option>
                    )}
                </select>
            </div>
            <button id='deleteModelsButton' disabled={selectedModels.size === 0} className='simple-button' onClick={handleDeleteButtonClicked}><Trash2 size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />Delete</button>
            <ModelTable data={models} selectedModels={selectedModels} handleModelCheckboxChange={handleModelCheckboxChange} />
        </>
    )
}

interface MetricCheckboxProps {
    metricName: string;
    checked: boolean;
    handleMetricCheckboxChange: ChangeEventHandler<HTMLInputElement>;
}

function MetricCheckbox({ metricName, checked, handleMetricCheckboxChange }: MetricCheckboxProps) {
    return (
        <span className='metric-container'>
            <input id={metricName} type='checkbox' value={metricName} checked={checked} onChange={handleMetricCheckboxChange} />
            <label htmlFor={metricName}>{metricName}</label>
        </span>
    );
}
