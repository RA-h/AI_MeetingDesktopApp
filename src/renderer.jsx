import { createRoot } from 'react-dom/client';
import MeetingMonitor from './components/MeetingMonitor';
const App = () => {
    return (
        <>
            <MeetingMonitor />
        </>
    )
}

const container = document.getElementById("root");
const root = createRoot(container);
root.render(<App />);
