import { useState, useEffect, type ChangeEvent, type ChangeEventHandler, useRef } from 'react';
import { type Model } from './Model';
import { ModelTable } from './ModelTable';
import { getUrl, fetchJsonData } from './dataUtils';
import { MetricChart, type MetricChartData } from './MetricChart';

interface MetricHistoryKey {
    id: string;
    metricName: string;
}

interface MetricHistory {
    id: string;
    metricName: string;
    metricHistory: number[];
}

const MODEL_METRIC_SEP = ': ';

const getLabel = (id: string, metricName: string): string => id + MODEL_METRIC_SEP + metricName;

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

    const chartDataRef = useRef(chartData);

    useEffect(() => { chartDataRef.current = chartData; }, [chartData]);

    useEffect(() => {
        console.log('useEffect on []');

        const controller = new AbortController();

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

        return () => controller.abort();
    }, []);

    useEffect(() => {
        console.log('useEffect on [selectedTag]');

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

        const controller = new AbortController();

        const keyMap = new Map<string, MetricHistoryKey>();
        for (const modelId of selectedModels)
            for (const metricName of selectedMetrics) {
                keyMap.set(getLabel(modelId, metricName), { id: modelId, metricName });
            }
        
        const selectedLabels = new Set<string>(keyMap.keys());
        const currentLabels = new Set<string>(chartDataRef.current.datasets.map(ds => ds.label).filter(l => l !== undefined));

        const addedLabels = selectedLabels.difference(currentLabels);
        const addedKeys = [...addedLabels].map(l => keyMap.get(l)).filter(k => k !== undefined);
        
        const removedLabels = currentLabels.difference(selectedLabels);

        const getRetainedDatasets = (prevChartData: MetricChartData) => prevChartData.datasets.filter(ds => typeof ds.label !== 'undefined' && !removedLabels.has(ds.label));

        if (addedKeys.length > 0) {
            fetchJsonData<MetricHistory[]>(getUrl('metric-history'), controller.signal, addedKeys, 'POST')
                .then(data => {
                    setChartData(prev => {
                        const retainedDatsets = removedLabels.size > 0 ? getRetainedDatasets(prev) : prev.datasets;
                        const addedDatasets = data.map(m =>
                        ({
                            label: getLabel(m.id, m.metricName),
                            data: m.metricHistory.map((v, i) => ({ x: i + 1, y: v }))
                        }));
                        return { datasets: [...retainedDatsets, ...addedDatasets] };
                    });
                })
                .catch(handleFetchError);
        }
        else if (removedLabels.size > 0) {
            setChartData(prev => {
                return { datasets: getRetainedDatasets(prev) };
            });
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
