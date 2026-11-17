import React, { useCallback } from 'react';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { dimens } from './res/dimens';
import { anim } from './res/anim';
import { MemoryRouter, Routes, Route, useLocation, type Location } from 'react-router-dom';
import CalendarHomePage from './pages/CalendarHomePage';
import { CalendarTodosPage } from './pages/CalendarTodosPage';
import CalendarSettingsPage from './pages/CalendarSettingsPage';
import { CalendarWeekViewportProvider } from './components/CalendarWeekViewport';
import { CalendarNewEventPage } from './pages/CalendarNewEventPage';

import { CalendarSearchPage } from './pages/CalendarSearchPage';
import { CalendarDateJumpPage } from './pages/CalendarDateJumpPage';
import { CalendarDateCalculatePage } from './pages/CalendarDateCalculatePage';
import { CalendarSubscriptionPage } from './pages/CalendarSubscriptionPage';
import { CalendarEventDetailPage } from './pages/CalendarEventDetailPage';
import { CalendarDeskThemePage } from './pages/CalendarDeskThemePage';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { useAppNavigate } from './navigation';
import './calendar-adaptive.css';
import './calendar-todos.css';
import { CalendarDetailWorkspace } from './components/CalendarDetailWorkspace';
import { CalendarEditorLayer } from './components/CalendarEditorLayer';
import { CalendarSurfaceContext } from './components/CalendarSurfaceContext';
import { calendarEditorBackground, isCalendarEditor } from './workspaceRouting';


// --- Navigation Handler ---
const CalendarNavigationHandler: React.FC = () => {
    const { back } = useAppNavigate();
    const location = useLocation();

    const handleBack = useCallback(() => {
        if (location.pathname === '/todos') return false;
        if (location.pathname !== '/' || new URLSearchParams(location.search).get('menu') === 'open') {
            back();
            return true;
        }
        return false;
    }, [back, location.pathname, location.search]);

    useAppNavigationHandler('calendar', { onBack: handleBack });

    return null;
};

const CalendarWorkspace: React.FC = () => {
    const location = useLocation(), editorOpen = isCalendarEditor(location.pathname);
    const previous = React.useRef<Location | undefined>(undefined), returnFocus = React.useRef<HTMLElement | null>(null);
    React.useLayoutEffect(() => { if (!editorOpen) previous.current = location; }, [editorOpen, location]);
    const background = editorOpen ? calendarEditorBackground(location, previous.current) : location;
    return <div className="calendar-workspace" data-calendar-workspace>
      <div className="calendar-workspace-background" data-calendar-workspace-background inert={editorOpen}
        onClickCapture={event=>{if(editorOpen){event.preventDefault();event.stopPropagation();return;}returnFocus.current=(event.target as HTMLElement).closest<HTMLElement>('button,input,textarea,[tabindex]')}}>
        <CalendarSurfaceContext.Provider value={editorOpen}>
          <Routes location={background}>
            <Route path="/" element={<CalendarHomePage />} />
            <Route path="/todos" element={<CalendarTodosPage />} />
            <Route path="/todos/new" element={<CalendarTodosPage />} />
            <Route path="/todos/:todoId/edit" element={<CalendarTodosPage />} />
            <Route path="/settings" element={<CalendarSettingsPage />} />
            <Route path="/event/:eventId" element={<CalendarDetailWorkspace><CalendarEventDetailPage /></CalendarDetailWorkspace>} />
            <Route path="/search" element={<CalendarSearchPage />} />
            <Route path="/date-jump" element={<CalendarDateJumpPage />} />
            <Route path="/date-calculate" element={<CalendarDateCalculatePage />} />
            <Route path="/subscription" element={<CalendarSubscriptionPage />} />
            <Route path="/desk-theme" element={<CalendarDeskThemePage />} />
          </Routes>
        </CalendarSurfaceContext.Provider>
      </div>
      {editorOpen && <CalendarEditorLayer editing={location.pathname!=='/new-event'} returnFocus={returnFocus.current}>
        <Routes><Route path="/new-event" element={<CalendarNewEventPage />} /><Route path="/event/:eventId/edit" element={<CalendarNewEventPage />} /></Routes>
      </CalendarEditorLayer>}
    </div>;
};

// --- Main App Component ---
const CalendarApp: React.FC = () => {
    const { isDark } = useDarkMode();
    const themeColors = isDark
        ? { ...manifest.theme.colors, ...(manifest.theme.colorsDark ?? {}) }
        : manifest.theme.colors;
    const appColors = isDark ? { ...colors, ...colorsDark } : colors;
    const appColorStates = isDark ? { ...colorStates, ...colorStatesDark } : colorStates;
    const cssVars = {
        ...themeToCssVars(applySkinToThemeColors(themeColors)),
        ...dimensToCssVars(appColors, { prefix: '--app-c-' }),
        ...dimensToCssVars(appColorStates, { prefix: '--app-cs-' }),
        ...dimensToCssVars(dimens),
        ...dimensToCssVars(anim, { prefix: '--app-' }),
    };
    return (
        <div className="calendar-app-shell h-full w-full" style={cssVars as React.CSSProperties}>
            <style>{`
                .calendar-app-shell ::-webkit-scrollbar { display: none; }
                .calendar-app-shell, .calendar-app-shell * { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
            <MemoryRouter>
                <CalendarWeekViewportProvider>
                <CalendarNavigationHandler />
                <CalendarWorkspace />
                </CalendarWeekViewportProvider>
            </MemoryRouter>
        </div>
    );
};

export default CalendarApp;
