import { useState, type JSX } from 'react';
import { ModelsTab } from './ModelsTab';
import { TrainingTab } from './TrainingTab';

interface TabDef {
    name: string;
    content: JSX.Element;
}

export default function App() {
    const [tab, setTab] = useState('Models');
    
    const tabDefs: TabDef[] = [
        { name: 'Models', content: <ModelsTab /> },
        { name: 'Training', content: <TrainingTab active={tab === 'Training'} /> }
    ];

    return (
        <>
            <nav className='navbar'>
                <ul className='navbar-menu'>
                    {
                        tabDefs.map(def => 
                            <li key={def.name} className={`navbar-menuitem ${tab == def.name ? 'active' : ''}`} onClick={() => setTab(def.name)}>{def.name}</li>
                        )
                    }
                </ul>
            </nav>
            <div>
                {
                    tabDefs.map(def =>
                        <div key={def.name} className={`tab-content ${tab == def.name ? 'active' : ''}`}>
                            {def.content}
                        </div>
                    )
                }
            </div>
        </>
    );
}