import React, { useCallback, useContext, useEffect } from 'react';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { dimens } from './res/dimens';
import { anim } from './res/anim';
import {
    MemoryRouter,
    Routes,
    Route,
    useLocation,
    useNavigate,
    UNSAFE_NavigationContext,
} from 'react-router-dom';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { AppNavigatorRegistry } from '../../os/AppNavigatorRegistry';
import { useActivityContext } from '../../os/ActivityContext';
import { ConversationListPage } from './components/ConversationListPage';
import { NewMessagePage } from './components/NewMessagePage';
import { ConversationDetailPage } from './components/ConversationDetailPage';
import { SettingsPage } from './components/SettingsPage';
import { FreeNetworkSmsPage } from './components/FreeNetworkSmsPage';
import { AdvancedSettingsPage } from './components/AdvancedSettingsPage';
import { FiveGMessagePage } from './components/FiveGMessagePage';
import { SettingsPlaceholderPage } from './components/SettingsPlaceholderPage';
import { useSmsStore } from './state';
import { useAppNavigate } from './navigation';
import { smsComposeParent } from './composeOverlay';
import './workspace.css';

/** Handles back navigation and route observation for the OS */
const SmsNavigationHandler: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { navigator } = useContext(UNSAFE_NavigationContext);
    const { activityId } = useActivityContext();
    const { back } = useAppNavigate();
    const mem = navigator as { index?: number; entries?: unknown[] };

    const handleBackPress = useCallback((): boolean => {
        if (location.pathname === '/' && !smsComposeParent(location.pathname, location.search)) return false;
        // A recreated/Intent overlay may be the first MemoryRouter entry.
        // Close that overlay before delegating Back to the Activity stack.
        if ((mem.index ?? 0) <= 0 && !smsComposeParent(location.pathname, location.search)) return false;
        back();
        return true;
    }, [back, location.pathname, location.search, mem]);

    // Activity-level navigator 注册：用于 OS 在 foreign-task push 时（如 12306 调用 ACTION_VIEW + scheme=sms
    // 把 SMS Activity 推到 12306 task 上）通过 navigateToActivity 把内部路由切到 /new 等目标 route。
    // 不注册的话，OS 的 waitForNavigator 会等到 5 秒超时再放弃。
    // 默认 replace=true 兼容 OS 内部"重置到根"的旧调用，但尊重显式 { replace: false } 让 singleTask 等场景能 push。
    useEffect(() => {
        const navFn = (path: string, opts?: { replace?: boolean }) => {
            navigate(path, { replace: opts?.replace ?? true });
        };
        AppNavigatorRegistry.registerActivity(activityId, { navigate: navFn, back: handleBackPress }, 'sms');
        return () => {
            AppNavigatorRegistry.unregisterActivity(activityId);
        };
    }, [activityId, handleBackPress, navigate]);

    useAppNavigationHandler('sms', {
        onBack: handleBackPress,
        onNavigate: (path, navigateTo) => {
            const normalized =
                typeof path === 'string'
                    ? (path.startsWith('/') ? path : `/${path}`)
                    : null;
            if (!normalized) return;
            navigateTo(normalized);
        },
    });

    return null;
};

const SmsRouteContent: React.FC = () => (
    <Routes>
        <Route path="/" element={<div className="sms-workspace-empty" aria-hidden="true" />} />
        <Route path="/new" element={<NewMessagePage />} />
        <Route path="/conversation/:conversationId" element={<ConversationDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/free-network-sms" element={<FreeNetworkSmsPage />} />
        <Route path="/settings/advanced" element={<AdvancedSettingsPage />} />
        <Route path="/settings/5g-message" element={<FiveGMessagePage />} />
        <Route path="/settings/*" element={<SettingsPlaceholderPage />} />
    </Routes>
);

const SmsWorkspace: React.FC = () => {
    const location = useLocation();
    const search = new URLSearchParams(location.search);
    const isRoot = location.pathname === '/';
    const isConversation = location.pathname.startsWith('/conversation/');
    const isCompose = location.pathname === '/new';
    const isSystemPicker = isCompose && search.get('panel') === 'contacts';
    const isAdaptiveMessagingRoute = (isRoot || isConversation || isCompose) && !isSystemPicker;

    return (
        <div className="sms-workspace">
            <div
                className={`sms-workspace-grid ${isAdaptiveMessagingRoute ? 'is-adaptive' : 'is-single'} ${isRoot ? 'is-root' : ''}`}
                data-sms-workspace
                data-sms-workspace-route={isRoot ? 'list' : isCompose ? 'compose' : isConversation ? 'conversation' : 'single'}
            >
                <aside className="sms-workspace-master" data-sms-master-pane>
                    <ConversationListPage />
                </aside>
                <main className="sms-workspace-detail" data-sms-detail-pane>
                    <SmsRouteContent />
                </main>
            </div>
        </div>
    );
};


/** SMS App root component */
const SmsApp: React.FC = () => {
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

    // SMS_RECEIVED is handled by the lightweight OS bootstrap receiver,
    // so incoming messages still work when the app UI is not mounted.

    // Cleanup pending send-status timers on unmount
    useEffect(() => {
        return () => {
            useSmsStore.getState().clearTimers();
        };
    }, []);

    return (
        <div className="h-full w-full" style={cssVars as React.CSSProperties}>
            <MemoryRouter>
                <SmsNavigationHandler />
                <SmsWorkspace />
            </MemoryRouter>
        </div>
    );
};

export default SmsApp;
