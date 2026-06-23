import ReactDOM from 'react-dom/client';
import { AuthWrapper } from './app/AuthWrapper';
import { AnalyticsInitializer } from './utils/analytics';
import './styles/index.scss';

AnalyticsInitializer();

// Lock to portrait for PWA standalone mode
if (window.matchMedia('(display-mode: standalone)').matches && screen.orientation?.lock) {
    screen.orientation.lock('portrait').catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')!).render(<AuthWrapper />);
