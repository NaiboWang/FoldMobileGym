import React from 'react';
export const CalendarSurfaceContext = React.createContext(false);
/** The foreground editor owns main; its still-visible inert background owns backgroundMain. */
export const useCalendarMainScrollName = () => React.useContext(CalendarSurfaceContext) ? 'backgroundMain' : 'main';
