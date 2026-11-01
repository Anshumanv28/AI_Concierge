/**
 * Email sending tool (standalone, separate from booking creation)
 */
const { sendBookingConfirmation } = require("../services/emailService");
const Booking = require("../models/Booking");

/**
 * Send email confirmation
 * @param {Object} params - Tool parameters
 * @param {string} params.bookingId - Booking ID to send confirmation for
 * @param {string} [params.customerEmail] - Corrected email to send to and save on the
 *   booking, if the customer provided a different one than what's on record
 * @returns {Promise<Object>} Email sending status
 */
const execute = async (params) => {
  console.log(`🔧 [EMAIL_TOOL] Starting email send`);
  console.log(`📦 [EMAIL_TOOL] Params:`, JSON.stringify(params, null, 2));

  try {
    const { bookingId, customerEmail } = params;

    if (!bookingId) {
      const error = "Booking ID parameter is required";
      console.error(`❌ [EMAIL_TOOL] ${error}`);
      throw new Error(error);
    }

    // Find the booking
    console.log(`🔍 [EMAIL_TOOL] Finding booking with ID: ${bookingId}`);
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      const error = "Booking not found";
      console.error(`❌ [EMAIL_TOOL] ${error}`);
      throw new Error(error);
    }

    // If the customer gave a corrected email, save it on the booking so the
    // record (and any future resend) uses the right address going forward.
    if (customerEmail && customerEmail !== booking.customerEmail) {
      console.log(
        `✏️ [EMAIL_TOOL] Updating stored email from ${
          booking.customerEmail || "(none)"
        } to ${customerEmail}`
      );
      booking.customerEmail = customerEmail;
      await booking.save();
    }

    // Send email confirmation
    console.log(
      `📧 [EMAIL_TOOL] Sending confirmation email to ${
        booking.customerEmail || "restaurant"
      }`
    );
    await sendBookingConfirmation(booking);

    console.log(`✅ [EMAIL_TOOL] Email sent successfully`);

    return {
      success: true,
      data: {
        bookingId,
        emailSent: true,
        customerEmail: booking.customerEmail || null,
        restaurantEmail: process.env.RESTAURANT_EMAIL || null,
      },
    };
  } catch (error) {
    // Log error but return structured response
    console.error(`❌ [EMAIL_TOOL] Error:`, error.message);
    console.error("Stack trace:", error.stack);
    return {
      success: false,
      error: error.message || "Failed to send email",
    };
  }
};

module.exports = {
  name: "send-email",
  description: "Send booking confirmation email",
  execute,
};
