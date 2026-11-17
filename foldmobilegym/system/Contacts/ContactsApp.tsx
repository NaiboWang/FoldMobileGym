import React, { useCallback, useEffect, useRef } from 'react';
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
  useParams,
  useSearchParams,
  UNSAFE_NavigationContext,
} from 'react-router-dom';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { BottomTabBar } from './components/BottomTabBar';
import { CallsPage, DialpadOverlay } from './pages/CallsPage';
import { SimulatedCallPage } from './pages/SimulatedCallPage';
import { ContactsPage } from './pages/ContactsPage';
import { NewContactPage } from './pages/NewContactPage';
import { ChooseExistingContactPage } from './pages/ChooseExistingContactPage';
import { SearchPage } from './pages/SearchPage';
import { ContactDetailPage } from './pages/ContactDetailPage';
import { CallDetailPage } from './pages/CallDetailPage';
import { PhoneSettingsHomePage } from './pages/PhoneSettingsHomePage';
import { PhonePreferenceScreenPage } from './pages/PhonePreferenceScreenPage';
import { useAppStrings } from '../../os/useAppStrings';
import { strings } from './res/strings';
import { stringsEn } from './res/strings.en';
import { useContactsGestures } from './hooks/useContactsGestures';
import './contacts-adaptive.css';
import { ContactDeleteDialog } from './components/ContactDeleteDialog';
import { AppNavigatorRegistry } from '../../os/AppNavigatorRegistry';
import { useActivityContext } from '../../os/ActivityContext';
import { getTracker } from '../../os/utils/memoryHistoryTracker';
import { ContactEditorBackProvider, useContactEditorBack } from './context/ContactEditorBackContext';
import { ContactDirectoryBackProvider, useContactDirectoryBack } from './context/ContactDirectoryBackContext';
import { contactsEditorBackFallback } from './utils/contactEditor';
import { ContactMenu } from './components/ContactMenu';
import { ContactSmsNumberPicker } from './components/ContactSmsNumberPicker';
import { ContactQrDialog } from './components/ContactQrDialog';
import { useContact } from './state';
import { contactSmsPickerBackFallback } from './utils/smsPhoneChoice';
import { contactQrBackFallback } from './utils/qrBack';
import { dialIntentRoute } from './utils/dialIntentRoute';
import { contactMenuBackFallback, isFavoriteContactOrigin } from './utils/detailOrigin';


/** Handles back navigation and route observation for the OS */
const ContactsNavigationHandler: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { navigator } = React.useContext(UNSAFE_NavigationContext);
  const { activityId, taskId } = useActivityContext();
  const historyIndexRef = useRef(0);
  const editorBack = useContactEditorBack();
  const directoryBack = useContactDirectoryBack();

  useEffect(() => {
    const memoryNavigator = navigator as any;
    if (typeof memoryNavigator?.index === 'number') {
      historyIndexRef.current = memoryNavigator.index;
    }
  }, [location, navigator]);

  const handleBackPress = useCallback((): boolean => {
    const memoryNavigator = navigator as any;
    const currentIndex =
      typeof memoryNavigator?.index === 'number' ? memoryNavigator.index : historyIndexRef.current;

    if (editorBack.current?.()) return true;
    const tracker = getTracker(navigator as object);
    const previous = tracker?.stack[(tracker?.index ?? 0) - 1];
    if (location.pathname === '/contacts/choose-existing') {
      const number = new URLSearchParams(location.search).get('number') ?? '';
      const previousParams = new URLSearchParams(previous?.search);
      if (new URLSearchParams(location.search).get('from') !== 'dialpad' || previous?.pathname !== '/' || previousParams.get('dialpad') !== 'true') {
        navigate(`/?${new URLSearchParams({ dialpad: 'true', number })}`, { replace: true }); return true;
      }
    }
    const editorFallback = contactsEditorBackFallback(location.pathname, location.search, previous);
    if (editorFallback) { navigate(editorFallback, { replace: true }); return true; }
    // Cold menus still own their visible detail, not a seeded calls route.
    const menuFallback = contactMenuBackFallback(location.pathname, location.search, previous);
    if (menuFallback) { navigate(menuFallback, { replace: true }); return true; }
    const smsPickerFallback = contactSmsPickerBackFallback(location.pathname, location.search, previous);
    if (smsPickerFallback) { navigate(smsPickerFallback, { replace: true }); return true; }
    const qrFallback = contactQrBackFallback(location.pathname, location.search, previous);
    if (qrFallback) { navigate(qrFallback, { replace: true }); return true; }
    const params = new URLSearchParams(location.search);
    if (!params.has('modal') && !params.has('menu') && directoryBack.current?.()) return true;
    if (currentIndex > 0) {
      navigate(-1);
      return true; // handled
    }

    const task = window.__OS__?.getState().tasks.find(task => task.taskId === taskId);
    if (task && task.rootAppId !== 'contacts') return false;

    // No history but not on root: go to calls tab.
    if (location.pathname !== '/') {
      navigate('/', { replace: true });
      return true;
    }

    return false; // let OS handle (exit)
  }, [directoryBack, editorBack, location.pathname, location.search, navigate, navigator, taskId]);

  // Borrowed Phone Activities must receive their own route and payload without
  // replacing the app-level navigator of an already running Phone task.
  useEffect(() => {
    AppNavigatorRegistry.registerActivity(activityId, {
      navigate: (path, options) => navigate(dialIntentRoute(path, window.__OS__?.getIntentPayload?.(activityId)), { replace: options?.replace ?? true }),
      back: handleBackPress,
    }, 'contacts');
    return () => AppNavigatorRegistry.unregisterActivity(activityId);
  }, [activityId, handleBackPress, navigate]);

  useAppNavigationHandler('contacts', {
    onBack: handleBackPress,
    onNavigate: (path, navigateToPath) => {
      const normalized = path.startsWith('/') ? path : `/${path}`;
      navigateToPath(dialIntentRoute(normalized, window.__OS__?.getIntentPayload?.(activityId)));
    },
  });

  return null;
};

const CallMasterDetailRoute: React.FC = () => {
  const { bindTap } = useContactsGestures();
  return (
    <div className="contacts-detail-shell h-full w-full bg-app-surface">
      <div className="contacts-master-pane relative min-h-0 bg-app-surface">
        <CallsPage
          directory
          detailTapProps={(callLogId) => bindTap('call.switch', { params: { callLogId } })}
        />
        <BottomTabBar />
      </div>
      <div className="contacts-detail-pane min-h-0 bg-app-bg"><CallDetailPage /></div>
    </div>
  );
};

const ContactMasterDetailRoute: React.FC = () => {
  const { bindTap } = useContactsGestures();
  const [search] = useSearchParams();
  const [directorySearching, setDirectorySearching] = React.useState(() => Boolean(search.get('q')));
  const dialogOpener = useRef<HTMLElement | null>(null);
  const { contactId } = useParams<{ contactId: string }>();
  const contact = useContact(contactId);
  const confirmingDelete = search.get('modal') === 'delete';
  const menuOpen = search.get('menu') === 'more';
  const smsPickerOpen = !menuOpen && search.get('modal') === 'sms';
  const qrOpen = !menuOpen && search.get('modal') === 'qr' && !!contact;
  const favoritesOrigin = isFavoriteContactOrigin(search);
  return (
    <div className={`contacts-detail-shell contacts-directory-detail-shell h-full w-full bg-app-surface${favoritesOrigin ? ' contacts-favorite-detail-shell' : ''}`} data-contacts-detail-origin={favoritesOrigin ? 'favorites' : 'directory'} data-directory-searching={directorySearching || undefined} onClickCapture={event => {
      const trigger = (event.target as HTMLElement).closest<HTMLElement>('[data-trigger="contact.delete.open"], [data-trigger="contact.menu.open"], [data-trigger="contact.sms.picker.open"], [data-trigger="contact.qr.open"]');
      if (trigger) dialogOpener.current = trigger;
    }}>
      <div inert={confirmingDelete || menuOpen || smsPickerOpen || qrOpen || undefined} style={{ display: 'contents' }}>
        {favoritesOrigin ? <div className="contacts-favorite-detail-pane min-h-0 bg-app-bg"><ContactDetailPage /></div> : <>
          <div className="contacts-master-pane relative min-h-0 bg-app-surface">
            <ContactsPage
              directory
              onDirectorySearchChange={setDirectorySearching}
              detailTapProps={(contactId) => bindTap('contact.switch', { params: { contactId } })}
            />
          </div>
          <div className="contacts-detail-pane min-h-0 bg-app-bg"><ContactDetailPage /></div>
          <div className="contacts-directory-detail-tabs"><BottomTabBar /></div>
        </>}
      </div>
      {confirmingDelete && <ContactDeleteDialog returnFocus={dialogOpener.current} />}
      {menuOpen && <ContactMenu />}
      {smsPickerOpen && <ContactSmsNumberPicker returnFocus={dialogOpener.current} />}
      {qrOpen && contact && <ContactQrDialog contact={contact} returnFocus={dialogOpener.current} />}
    </div>
  );
};

const ContactsChrome: React.FC = () => {
  const location = useLocation();
  const s = useAppStrings(strings, stringsEn);
  const [isUnfolded, setIsUnfolded] = React.useState(
    () => window.__FOLDAGENT__?.getState().posture === 'unfolded',
  );
  React.useEffect(() => {
    const syncPosture = () => setIsUnfolded(window.__FOLDAGENT__?.getState().posture === 'unfolded');
    window.addEventListener('foldagent:posturechange', syncPosture);
    return () => window.removeEventListener('foldagent:posturechange', syncPosture);
  }, []);
  const showTabBar =
    location.pathname === '/' ||
    location.pathname === '/contacts';
  const searchParams = new URLSearchParams(location.search);
  const dialpadOpen = location.pathname === '/' && searchParams.get('dialpad') === 'true';
  // Keep the draft associated with its own history entry, including editor round-trips.
  const dialpadDrafts = React.useRef(new Map<string, string>());
  const [draft, setDraft] = React.useState<{ key: string; digits: string } | null>(null);
  const initialNumber = searchParams.get('number') ?? '';
  const dialpadDigits = draft?.key === location.key ? draft.digits
    : dialpadDrafts.current.get(location.key) ?? initialNumber.replace(/\s/g, '');
  const updateDialpad: React.Dispatch<React.SetStateAction<string>> = next => {
    const current = dialpadDrafts.current.get(location.key) ?? initialNumber.replace(/\s/g, '');
    const digits = typeof next === 'function' ? next(current) : next;
    dialpadDrafts.current.set(location.key, digits);
    if (dialpadDrafts.current.size > 30) dialpadDrafts.current.delete(dialpadDrafts.current.keys().next().value!);
    setDraft({ key: location.key, digits });
  };

  const routes = (
    <Routes>
      <Route path="/" element={<CallsPage dialpadDigits={dialpadDigits} getDialpadDigits={() => dialpadDrafts.current.get(location.key) ?? dialpadDigits} />} />
      <Route path="/contacts" element={<ContactsPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/contact/:contactId" element={<ContactMasterDetailRoute />} />
      <Route path="/call/:callLogId" element={<CallMasterDetailRoute />} />
      <Route path="/calling" element={<SimulatedCallPage />} />
      <Route path="/contacts/new" element={<NewContactPage />} />
      <Route path="/contacts/choose-existing" element={<ChooseExistingContactPage />} />
      <Route path="/contact/:contactId/edit" element={<NewContactPage />} />
      <Route path="/settings/calls" element={<PhoneSettingsHomePage />} />
      <Route path="/settings/contacts" element={<PhoneSettingsHomePage />} />
      <Route path="/settings/page/:pageId" element={<PhonePreferenceScreenPage />} />
    </Routes>
  );

  return (
    <div
      className={showTabBar ? 'contacts-home-shell h-full w-full bg-app-surface' : 'h-full w-full relative bg-app-surface'}
      data-dialpad-open={dialpadOpen || undefined}
      data-dialpad-seeded={dialpadOpen && Boolean(dialpadDigits) || undefined}
      data-favorites={location.pathname === '/contacts' && searchParams.get('fav') === 'true' || undefined}
    >
      <div className={showTabBar ? 'contacts-route-pane relative min-h-0' : 'h-full w-full relative'}>
        {routes}
      </div>

      {showTabBar ? (
        <div className="contacts-wide-placeholder" aria-hidden="true">
          <div className="contacts-wide-placeholder-icon">
            <span />
            <span />
          </div>
          <div className="contacts-wide-placeholder-title">{s.wide_select_title}</div>
          <div className="contacts-wide-placeholder-subtitle">{s.wide_select_subtitle}</div>
        </div>
      ) : null}
      {dialpadOpen ? <DialpadOverlay digits={dialpadDigits} getDigits={() => dialpadDrafts.current.get(location.key) ?? dialpadDigits} setDigits={updateDialpad} isUnfolded={isUnfolded} /> : null}
      {showTabBar ? <BottomTabBar /> : null}
    </div>
  );
};


/** Contacts (com.android.contacts) App root component */
const ContactsApp: React.FC = () => {
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
    <div className="contacts-app-root h-full w-full" style={cssVars as React.CSSProperties}>
      <MemoryRouter>
        <ContactEditorBackProvider>
          <ContactDirectoryBackProvider>
          <ContactsNavigationHandler />
          <ContactsChrome />
          </ContactDirectoryBackProvider>
        </ContactEditorBackProvider>
      </MemoryRouter>
    </div>
  );
};

export default ContactsApp;
