import { Shop } from "../types";

export const isShopClosed = (shop: Shop | null): boolean => {
  if (!shop || !shop.workingHours || !shop.workingHours.enabled) return false;

  const now = new Date();
  const dayIndex = String(now.getDay()); // "0" to "6"
  const dayConfig = shop.workingHours.days?.[dayIndex];

  if (!dayConfig || !dayConfig.enabled) {
    return true;
  }

  // Parse open and close times
  const [openH, openM] = dayConfig.open.split(":").map(Number);
  const [closeH, closeM] = dayConfig.close.split(":").map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  if (closeMinutes < openMinutes) {
    // Overnight hours e.g. 18:00 to 02:00
    return currentMinutes < openMinutes && currentMinutes > closeMinutes;
  }

  return currentMinutes < openMinutes || currentMinutes > closeMinutes;
};

export function getClientStartOfTodayInTimezone(timezone: string): Date {
  try {
    const tzParts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    }).formatToParts(new Date());

    const year = parseInt(tzParts.find(p => p.type === 'year')!.value, 10);
    const month = parseInt(tzParts.find(p => p.type === 'month')!.value, 10) - 1;
    const day = parseInt(tzParts.find(p => p.type === 'day')!.value, 10);

    const testDate = new Date(Date.UTC(year, month, day, 12, 0, 0));
    const testParts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      hour12: false
    }).formatToParts(testDate);

    const tYear = parseInt(testParts.find(p => p.type === 'year')!.value, 10);
    const tMonth = parseInt(testParts.find(p => p.type === 'month')!.value, 10) - 1;
    const tDay = parseInt(testParts.find(p => p.type === 'day')!.value, 10);
    const tHour = parseInt(testParts.find(p => p.type === 'hour')!.value, 10);
    const tMinute = parseInt(testParts.find(p => p.type === 'minute')!.value, 10);

    const localTimeMs = Date.UTC(tYear, tMonth, tDay, tHour, tMinute, 0);
    const utcTimeMs = testDate.getTime();
    const offsetMs = localTimeMs - utcTimeMs;

    const localMidnightMs = Date.UTC(year, month, day, 0, 0, 0);
    const utcMidnightMs = localMidnightMs - offsetMs;

    return new Date(utcMidnightMs);
  } catch (err) {
    const fallback = new Date();
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }
}
