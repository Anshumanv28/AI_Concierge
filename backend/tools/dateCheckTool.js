/**
 * Date and time checking tool - returns current date and time for context awareness
 */
const { getISTNow } = require("../utils/timezone");

/**
 * Get current date and time for context awareness
 * Helps detect if users are trying to book in the past
 * @param {Object} params - Tool parameters (empty, no params needed)
 * @returns {Promise<Object>} Current date (YYYY-MM-DD) and time (HH:mm) in 24-hour format, anchored to IST
 */
const execute = async (params) => {
  console.log(`🔧 [DATE_TIME_CHECK_TOOL] Getting current date and time`);

  try {
    const istNow = getISTNow();

    console.log(
      `✅ [DATE_TIME_CHECK_TOOL] Current date: ${istNow.today}, Current time: ${istNow.currentTime}`
    );

    return {
      success: true,
      data: istNow,
    };
  } catch (error) {
    console.error(`❌ [DATE_TIME_CHECK_TOOL] Error:`, error.message);
    console.error("Stack trace:", error.stack);
    return {
      success: false,
      error: error.message || "Failed to get current date and time",
    };
  }
};

module.exports = {
  name: "check-date",
  description:
    "Get current date and time for context awareness. Use this to detect if users are trying to book in the past and to calculate relative dates like 'today', 'tomorrow', etc.",
  execute,
};
