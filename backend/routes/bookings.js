const express = require("express");
const router = express.Router();
const Booking = require("../models/Booking");
const { sendBookingConfirmation } = require("../services/emailService");
const {
  getBookingsForDate,
  isTimeTaken,
  findNearestAvailableSlots,
} = require("../utils/slotFinder");
const { toISTMidnightUTC } = require("../utils/timezone");

/**
 * POST /api/bookings
 * Create a new booking with inline duplicate check
 */
router.post("/", async (req, res) => {
  const startTime = Date.now();
  console.log(`🌐 [BACKEND] POST /api/bookings - Booking creation request`);
  console.log(`📦 [BACKEND] Request body:`, JSON.stringify(req.body, null, 2));

  try {
    const {
      numberOfGuests,
      bookingDate,
      bookingTime,
      cuisinePreference,
      specialRequests,
      weatherInfo,
      seatingPreference,
      customerName,
      customerEmail,
      customerContact,
    } = req.body;

    // Validation
    if (!numberOfGuests || !bookingDate || !bookingTime) {
      return res.status(400).json({
        success: false,
        error: "numberOfGuests, bookingDate, and bookingTime are required",
      });
    }

    // Validate time format (24-hour HH:mm)
    if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(bookingTime)) {
      return res.status(400).json({
        success: false,
        error: "Invalid time format. Use 24-hour format (HH:mm)",
      });
    }

    // Normalize seating preference to lowercase and validate
    let normalizedSeatingPreference = "indoor"; // default
    if (seatingPreference) {
      const normalized = seatingPreference.toLowerCase().trim();
      if (normalized === "indoor" || normalized === "outdoor") {
        normalizedSeatingPreference = normalized;
      } else {
        console.warn(
          `⚠️ [BACKEND] Invalid seating preference "${seatingPreference}", defaulting to "indoor"`
        );
      }
    }

    // Shared conflict check (also excludes cancelled bookings, unlike the
    // previous inline query here which didn't filter on status)
    const bookingsForDate = await getBookingsForDate(bookingDate);

    if (isTimeTaken(bookingsForDate, bookingTime)) {
      const alternatives = findNearestAvailableSlots(
        bookingTime,
        bookingsForDate.map((b) => b.bookingTime)
      );
      return res.status(409).json({
        success: false,
        error: "That exact time slot is already booked",
        data: { alternatives },
      });
    }

    // Create booking (customerName defaults to "Guest" in schema if omitted)
    console.log(
      `📋 [BACKEND] Seating preference: "${seatingPreference}" → normalized to "${normalizedSeatingPreference}"`
    );
    const booking = await Booking.create({
      numberOfGuests,
      bookingDate: toISTMidnightUTC(bookingDate),
      bookingTime,
      cuisinePreference: cuisinePreference || "",
      specialRequests: specialRequests || "",
      weatherInfo: weatherInfo || null,
      seatingPreference: normalizedSeatingPreference,
      customerName: customerName || "Guest",
      customerEmail: customerEmail || "",
      customerContact: customerContact || "",
      // Auto-confirmed: there's no manual/restaurant approval step in this flow.
      status: "confirmed",
    });

    const duration = Date.now() - startTime;
    console.log(`✅ [BACKEND] Booking created successfully in ${duration}ms`);
    console.log(
      `📋 [BACKEND] Booking ID: ${booking._id}, Date: ${bookingDate}, Time: ${bookingTime}, Guests: ${numberOfGuests}`
    );

    // Send email confirmation (log errors but don't fail booking)
    try {
      await sendBookingConfirmation(booking);
      console.log(
        `📧 [BACKEND] Confirmation email sent for booking ${booking._id}`
      );
    } catch (emailError) {
      console.error(
        `❌ [BACKEND] Email failed but booking created: ${emailError.message}`
      );
      // Don't throw - booking still succeeds
    }

    res.status(201).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error("Booking creation error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create booking",
    });
  }
});

/**
 * GET /api/bookings
 * Get all bookings
 */
router.get("/", async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error("Get bookings error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch bookings",
    });
  }
});

/**
 * GET /api/bookings/availability
 * Check if date/time slot is available
 * Query params: date (YYYY-MM-DD), time (HH:mm, optional)
 *
 * Registered before /:id - Express matches routes in order, and a literal
 * segment like "availability" would otherwise be swallowed by the /:id param.
 */
router.get("/availability", async (req, res) => {
  const startTime = Date.now();
  console.log(`🌐 [BACKEND] GET /api/bookings/availability`);
  console.log(`📦 [BACKEND] Query params:`, JSON.stringify(req.query, null, 2));

  try {
    const { date, time } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: "Date parameter is required (YYYY-MM-DD format)",
      });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: "Invalid date format. Use YYYY-MM-DD",
      });
    }

    // Validate time format if provided
    if (time && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      return res.status(400).json({
        success: false,
        error: "Invalid time format. Use 24-hour format (HH:mm)",
      });
    }

    const allBookingsForDate = await getBookingsForDate(date);

    let existingBookingsCount;
    let isAvailable;
    let alternatives = [];

    if (time) {
      existingBookingsCount = allBookingsForDate.filter(
        (b) => b.bookingTime === time
      ).length;
      isAvailable = existingBookingsCount === 0;
      if (!isAvailable) {
        alternatives = findNearestAvailableSlots(
          time,
          allBookingsForDate.map((b) => b.bookingTime)
        );
      }
    } else {
      existingBookingsCount = allBookingsForDate.length;
      isAvailable = existingBookingsCount === 0;
    }

    const duration = Date.now() - startTime;

    console.log(`✅ [BACKEND] Availability check completed in ${duration}ms`);
    console.log(
      `📊 [BACKEND] Result: ${isAvailable ? "AVAILABLE" : "NOT AVAILABLE"} (${existingBookingsCount} existing booking(s))`
    );

    res.json({
      success: true,
      data: {
        available: isAvailable,
        date,
        time: time || null,
        existingBookings: existingBookingsCount,
        alternatives,
      },
    });
  } catch (error) {
    console.error("Availability check error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to check availability",
    });
  }
});

/**
 * GET /api/bookings/:id
 * Get a specific booking by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "Booking not found",
      });
    }

    res.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error("Get booking error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch booking",
    });
  }
});

/**
 * DELETE /api/bookings/:id
 * Cancel a booking
 */
router.delete("/:id", async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status: "cancelled" },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "Booking not found",
      });
    }

    res.json({
      success: true,
      data: booking,
      message: "Booking cancelled successfully",
    });
  } catch (error) {
    console.error("Cancel booking error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to cancel booking",
    });
  }
});

module.exports = router;
