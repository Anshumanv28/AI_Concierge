/**
 * Shared availability helpers used by dateAvailabilityTool.js, bookingTool.js,
 * and routes/bookings.js so all four conflict-check call sites share one
 * query and one definition of "taken".
 *
 * Operating hours come from env vars RESTAURANT_OPEN_HOUR / RESTAURANT_CLOSE_HOUR
 * (24-hour integers, e.g. 11 and 22), falling back to 11-22 if unset/invalid.
 */
const Booking = require("../models/Booking");
const { toISTMidnightUTC } = require("./timezone");

const DEFAULT_OPEN_HOUR = 11;
const DEFAULT_CLOSE_HOUR = 22;
const SLOT_INTERVAL_MINUTES = 30;

const getOperatingHours = () => {
  const openHour = parseInt(process.env.RESTAURANT_OPEN_HOUR, 10);
  const closeHour = parseInt(process.env.RESTAURANT_CLOSE_HOUR, 10);
  return {
    openHour: Number.isNaN(openHour) ? DEFAULT_OPEN_HOUR : openHour,
    closeHour: Number.isNaN(closeHour) ? DEFAULT_CLOSE_HOUR : closeHour,
  };
};

const timeToMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const minutesToTime = (mins) => {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
};

// All non-cancelled bookings for a date - the one query every call site should share.
const getBookingsForDate = async (date) => {
  return Booking.find({
    bookingDate: toISTMidnightUTC(date),
    status: { $ne: "cancelled" },
  });
};

const isTimeTaken = (bookings, time) => bookings.some((b) => b.bookingTime === time);

// Pure function: given already-taken "HH:mm" strings, find the closest `limit`
// available slots to the requested time within operating hours.
const findNearestAvailableSlots = (requestedTime, takenTimes, { limit = 3 } = {}) => {
  const { openHour, closeHour } = getOperatingHours();
  const openMin = openHour * 60;
  const closeMin = closeHour * 60;
  const takenSet = new Set(takenTimes);
  const requestedMin = timeToMinutes(requestedTime);

  const candidates = [];
  for (let m = openMin; m <= closeMin; m += SLOT_INTERVAL_MINUTES) {
    const slot = minutesToTime(m);
    if (takenSet.has(slot)) continue;
    candidates.push({ time: slot, distance: Math.abs(m - requestedMin) });
  }
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates.slice(0, limit).map((c) => c.time);
};

module.exports = {
  getOperatingHours,
  timeToMinutes,
  minutesToTime,
  getBookingsForDate,
  isTimeTaken,
  findNearestAvailableSlots,
};
