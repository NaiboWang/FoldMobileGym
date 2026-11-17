export const isAlarmRingingRoute=(pathname:string)=>/^\/alarm\/ringing\/[^/]+$/.test(pathname);
export function getAlarmRingingBackFallback(pathname:string,previous?:{pathname:string}){
  return isAlarmRingingRoute(pathname)&&!previous?'/alarm':null;
}
