import { useMemo, useState, type ChangeEventHandler } from 'react'
import { ModelStatus, type Model } from './types';
import './App.css'
import { formatColumnValue, type AnyColDef, type ColDef } from './tableUtils';

interface ModelTableProps {
    data: Model[];
    selectedModels: Set<string>;
    handleModelCheckboxChange: ChangeEventHandler<HTMLInputElement>;
}

type ColName = keyof Model;

type SortDir = -1 | 1;

const toPrimitive = (v: Model[ColName]): string | number => typeof v === 'object' ? JSON.stringify(v) : v;

const colDefs: AnyColDef<Model>[] = [
    {
        key: 'datetime', name: 'Date & Time', format: v =>
            new Date(v).toLocaleString(undefined, {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour12: false,
                hour: 'numeric',
                minute: 'numeric',
            })
    },
    { key: 'id', name: 'Id' },
    { key: 'className', name: 'Class' },
    { key: 'module', name: 'Module' },
    { key: 'args', name: 'Args' },
    { key: 'kwargs', name: 'KWArgs' },
    { key: 'trainableParams', name: 'Trainable Params', format: v => v.toString() },
    { key: 'minValLoss', name: 'Min Val Loss', format: v => v?.toFixed(4) ?? '' },
    { key: 'maxValAccuracy', name: 'Max Val Accuracy', format: v => v?.toFixed(4) ?? '' },
];
    
export function ModelTable({ data, selectedModels, handleModelCheckboxChange }: ModelTableProps) {
    const [sortCol, setSortCol] = useState<ColName>('datetime');
    const [sortDir, setSortDir] = useState<SortDir>(-1);

    const sortedData = useMemo(() => data.toSorted((a, b) => {
        const valA = toPrimitive(a[sortCol]);
        const valB = toPrimitive(b[sortCol]);

        let v;
        if (valA > valB)
            v = 1;
        else if (valA < valB)
            v = -1;
        else
            v = 0;

        v *= sortDir;

        return v;
    }), [data, sortCol, sortDir]);

    const sortStats = (col: ColName) => {
        if (col === sortCol) {
            setSortDir(prev => prev === 1 ? -1 : 1);
        } else {
            setSortCol(col);
            setSortDir(1);
        }
    };

    return (
        <table className='data-table sortable-table'>
            <thead>
                <tr>
                    <th></th>
                    {
                        colDefs.map(c =>
                            <th key={c.key} onClick={() => sortStats(c.key)}>{c.name}<SortArrow col={c.key} sortCol={sortCol} sortDir={sortDir} /></th>
                        )
                    }
                </tr>
            </thead>
            <tbody>
                {sortedData.map(r =>
                    <tr key={r.id} className={r.status === ModelStatus.Training ? 'training' : ''}>
                        <td>
                            <input id={r.id} type='checkbox' value={r.id} checked={selectedModels.has(r.id)} onChange={handleModelCheckboxChange} />
                        </td>
                        {
                            colDefs.map(c => <td key={c.key}>
                                {formatColumnValue(r, c as ColDef<Model, typeof c.key>)}
                            </td>)
                        }
                    </tr>
                )}
            </tbody>
        </table>
    );
}

interface SortArrowProps {
    col: ColName;
    sortCol: ColName;
    sortDir: SortDir;
}

function SortArrow({ col, sortCol, sortDir }: SortArrowProps) {
    let arrow;
    if (col === sortCol)
        arrow = sortDir === 1 ? '▲' : '▼';
    else
        arrow = '';
    return <span className='sort-arrow'>{arrow}</span>;
}