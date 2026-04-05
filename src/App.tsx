import { useState, useEffect, type ChangeEvent, type ChangeEventHandler, useRef } from 'react';
import { type Model } from './Model';
import { ModelTable } from './ModelTable';
import { getUrl, fetchJsonData } from './dataUtils';
import { MetricChart, type MetricChartData, type MetricChartDataSeries } from './MetricChart';
import type { ChartDataset } from 'chart.js';

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

const handleFetchError = (error: unknown) => {
    if (!(error instanceof Error && error.name === 'AbortError'))
        console.error(error);
};

function App() {
    const [tags, setTags] = useState<string[]>([]);
    const [selectedTag, setSelectedTag] = useState('');
    const [models, setModels] = useState<Model[]>([]);
    const [selectedModels, setSelectedModels] = useState(new Set<string>());
    const [metrics, setMetrics] = useState<string[]>([]);
    const [selectedMetrics, setSelectedMetrics] = useState(new Set<string>());
    const [chartData, setChartData] = useState<MetricChartData>({ datasets: [] });

    const selectedTagRef = useRef(selectedTag);

    const chartDataVersionRef = useRef(0);
    const datasetMapRef = useRef(new Map<string, MetricChartDataset>());

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
                console.log('sending message over ws', message);
                socketRef.current.send(JSON.stringify(message));
                return true;
            } catch (error) {
                console.error('error sending message', error);
            }
        }
        else
            console.warn('Unable to send message as open socket not available');
        return false;
    };

    useEffect(() => {
        console.log('useEffect on []');

        const controller = new AbortController();

        const initWebSocket = (url: string, onOpen: () => void): WebSocket => {
            const ws = new WebSocket(url);

            ws.onopen = () => {
                console.log('ws open');
                onOpen();
            };

            ws.onmessage = (event) => {
                try {
                    console.log('received ws message', event.data);

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
                                setSelectedModels(prev => new Set([...prev, model.id]));                                
                            }
                            break;
                        }
                        case 'model.update': {
                            const { model } = message;
                            if (model.tag === selectedTagRef.current) {
                                setModels(prev => prev.map(m => m.id === model.id ? model : m));
                            }
                            break;
                        }
                        case 'model.delete': {
                            const { id } = message;
                            setModels(prev => prev.filter(m => m.id !== id));
                            setSelectedModels(prev => new Set([...prev].filter(m => m !== id)));
                            break;
                        }
                    }
                } catch (error) {
                    console.error('error processing ws message', error);
                }
            };

            ws.onclose = () => {
                console.log('ws closed');
            };

            ws.onerror = (error) => {
                console.error('ws error', error);
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
        console.log('useEffect on [selectedTag]');

        if (selectedTagRef.current !== '')
            sendMessage({ type: 'tag.unsubscribe', tag: selectedTagRef.current });
        sendMessage({ type: 'tag.subscribe', tag: selectedTag });

        selectedTagRef.current = selectedTag;

        const controller = new AbortController();

        if (selectedTag !== '') {
            fetchJsonData<Model[]>(getUrl('models', { tag: selectedTag }), controller.signal)
                .then(data => {
                    setModels(data);
                    if (data.length > 0) {
                        const lastModel = data.reduce((last, current) => current.datetime > last.datetime ? current : last);
                        setSelectedModels(new Set([lastModel.id]));
                    }
                    else
                        setSelectedModels(new Set());
                })
                .catch(handleFetchError);
        }

        return () => controller.abort();
    }, [selectedTag]);

    useEffect(() => {
        console.log('useEffect on [selectedModels, selectedMetrics]');

        const setDifference = (a: Iterable<string>, b: Iterable<string>): string[] => {
            const setB = new Set(b);
            return [...a].filter(x => !setB.has(x));
        };

        const toDataset = (history: MetricHistory): MetricChartDataset => ({
            label: `${history.id}: ${history.metricName}`,
            data: history.metricHistory.map((v, i) => ({ x: i + 1, y: v }))
        });

        const controller = new AbortController();

        const chartDataVersion = ++chartDataVersionRef.current;

        const selectedKeys: string[] = [];
        for (const modelId of selectedModels)
            for (const metricName of selectedMetrics) {
                selectedKeys.push(keyToString(modelId, metricName));
            }

        const removedKeys = setDifference(datasetMapRef.current.keys(), selectedKeys);
        const addedKeys = setDifference(selectedKeys, datasetMapRef.current.keys());

        if (removedKeys.length > 0) {            
            const message: ModelRequest = {
                type: 'metric-history.unsubscribe',
                keys: removedKeys.map(getMetricHistoryKey)
            };
            sendMessage(message)
            removedKeys.forEach(k => datasetMapRef.current.delete(k));
            updateChartData();
        }
        
        if (addedKeys.length > 0) {
            const message: ModelRequest = {
                type: 'metric-history.subscribe',
                keys: addedKeys.map(getMetricHistoryKey)
            };
            sendMessage(message);
            fetchJsonData<MetricHistory[]>(getUrl('metric-history'), controller.signal, addedKeys.map(k => JSON.parse(k)), 'POST')
                .then(data => {
                    if (chartDataVersion !== chartDataVersionRef.current)
                        return;

                    data.forEach(h => datasetMapRef.current.set(keyToString(h.id, h.metricName), toDataset(h)));
                    updateChartData();
                })
                .catch(handleFetchError);
        }

        return () => controller.abort();
    }, [selectedModels, selectedMetrics]);

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

export default App
