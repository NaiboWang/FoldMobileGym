import { useLocation } from 'react-router-dom';
import { calendarEventIdFromPath } from '../eventIdentity';
export function useCalendarEventId() { return calendarEventIdFromPath(useLocation().pathname); }
