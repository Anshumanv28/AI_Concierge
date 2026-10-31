/**
 * Explicit IST (Asia/Kolkata) anchoring helpers.
 *
 * The restaurant operates on IST wall-clock time, but nothing in this codebase
 * enforced that explicitly - `new Date(dateStr)` on a plain "YYYY-MM-DD" string
 * parses as UTC midnight (not IST midnight), and `new Date()` + local getters
 * trust the server/container OS timezone to happen to be Asia/Kolkata. Both are
 * silent, environment-dependent bugs. These helpers make the IST anchoring
 * explicit regardless of where the process runs.
 */
const IST_TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET = "+05:30";

// Anchors a "YYYY-MM-DD" string to real IST midnight, returned as the
// correct UTC instant - replaces `new Date(dateStr)`, which parses as UTC
// midnight instead.
const toISTMidnightUTC = (dateStr) => new Date(`${dateStr}T00:00:00${IST_OFFSET}`);

// Current date/time as seen on an IST wall clock, independent of the
// server's OS timezone. Shape matches the previous dateCheckTool.js output.
const getISTNow = () => {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(now)
    .reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  // Some ICU versions render midnight as "24" with hour12:false.
  const hour = parts.hour === "24" ? "00" : parts.hour;

  const todayStr = `${parts.year}-${parts.month}-${parts.day}`;
  const currentTime = `${hour}:${parts.minute}`;

  return {
    today: todayStr,
    date: todayStr,
    currentTime,
    time: currentTime,
    dayOfWeek: new Intl.DateTimeFormat("en-US", {
      timeZone: IST_TIME_ZONE,
      weekday: "long",
    }).format(now),
    formatted: new Intl.DateTimeFormat("en-US", {
      timeZone: IST_TIME_ZONE,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(now),
    formattedTime: new Intl.DateTimeFormat("en-US", {
      timeZone: IST_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(now),
  };
};

module.exports = {
  IST_TIME_ZONE,
  toISTMidnightUTC,
  getISTNow,
};
