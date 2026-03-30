import { Chart, registerables, type ChartData, type ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';


Chart.register(...registerables, zoomPlugin);

export type MetricChartDataSeries = { x: number; y: number }[];

export type MetricChartData = ChartData<'line', MetricChartDataSeries, number>;

interface MetricChartProps {
    data: MetricChartData;
}

export function MetricChart({data}: MetricChartProps) {
    const options: ChartOptions<'line'> = {
        maintainAspectRatio: false,
        scales: {
            x: {
                type: 'linear',
                title: {
                    display: true,
                    text: 'epoch',
                    font: {
                        weight: 'bold',
                        size: 16
                    }
                },
                min: 1,
                suggestedMax: 10,
                ticks: {
                    callback: value => typeof value === 'number' && Number.isInteger(value) ? value : null
                }
            },
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'metric value',
                    font: {
                        weight: 'bold',
                        size: 16
                    }
                },
            }
        },
        datasets: {
            line: {
                borderWidth: 1,
                pointRadius: 1,
                pointHoverRadius: 2
            }
        },
        plugins: {
            colors: {
                forceOverride: true
            },
            zoom: {
                zoom: {
                    wheel: {
                        enabled: true
                    },
                    pinch: {
                        enabled: true
                    },
                    mode: 'x'
                },
                pan: {
                    enabled: true,
                    mode: 'x'
                },
                limits: {
                    x: {
                        min: 'original',
                        max: 'original'
                    }
                }
            }
        }
    };

    return (
        <div id='chartDiv'>
            <Line data={data} options={options} />
        </div>
    );
}