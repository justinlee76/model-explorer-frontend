import { useState, type JSX } from 'react';
import { ModelsTab } from '@/ModelsTab/ModelsTab';
import { TrainingTab } from '@/TrainingTab/TrainingTab';

type TabName = 'Models' | 'Training';

interface TabDef {
    name: TabName;
    content: JSX.Element;
}

export default function App() {
    const [tab, setTab] = useState<TabName>('Models');
    
    const tabDefs: TabDef[] = [
        { name: 'Models', content: <ModelsTab /> },
        { name: 'Training', content: <TrainingTab active={tab === 'Training'} /> }
    ];

    return (
        <>
            <nav className='navbar' aria-label='Primary'>
                <div className='navbar-menu' role='tablist'>
                    {
                        tabDefs.map(def => {
                            const active = tab === def.name;
                            return (
                                <button
                                    key={def.name}
                                    type='button'
                                    id={`tab-${def.name}`}
                                    role='tab'
                                    aria-selected={active}
                                    aria-controls={`tab-panel-${def.name}`}
                                    className={`navbar-menuitem ${active ? 'active' : ''}`}
                                    onClick={() => setTab(def.name)}
                                >
                                    {def.name}
                                </button>
                            );
                        })
                    }
                </div>
            </nav>
            <div>
                {
                    tabDefs.map(def => {
                        const active = tab === def.name;
                        return (
                            <div
                                key={def.name}
                                id={`tab-panel-${def.name}`}
                                role='tabpanel'
                                aria-labelledby={`tab-${def.name}`}
                                hidden={!active}
                                className='tab-content'
                            >
                                {def.content}
                            </div>
                        );
                    })
                }
            </div>
        </>
    );
}
