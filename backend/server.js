require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/database");
const errorHandler = require("./middleware/errorHandler");

// Import routes
const bookingsRoutes = require("./routes/bookings");
const weatherRoutes = require("./routes/weather");
const livekitRoutes = require("./routes/livekit");
const toolsRoutes = require("./routes/tools");
const conversationsRoutes = require("./routes/conversations");

// Email configuration check (non-blocking with timeout)
const checkEmailConfig = async () => {
  if (
    !process.env.EMAIL_USER ||
    !process.env.EMAIL_PASS ||
    !process.env.RESTAURANT_EMAIL
  ) {
    console.warn("\n⚠️  Email configuration incomplete:");
    console.warn(
      "   EMAIL_USER, EMAIL_PASS, and RESTAURANT_EMAIL must be set for email confirmations"
    );
    console.warn(
      "   Bookings will still be created, but confirmation emails will not be sent\n"
    );
    return;
  }

  // Use a timeout wrapper to ensure this never blocks server startup
  let emailCheckCompleted = false;
  let timeoutId = null;

  const emailCheckPromise = (async () => {
    try {
      const nodemailer = require("nodemailer");

      // Clean and validate env variables
      const emailUser = process.env.EMAIL_USER?.trim();
      const emailPass = process.env.EMAIL_PASS?.trim();

      if (!emailUser || !emailPass) {
        throw new Error("EMAIL_USER or EMAIL_PASS is empty after trimming");
      }

      // Check password length
      if (emailPass.length !== 16) {
        console.warn(
          `   ⚠️  EMAIL_PASS length is ${emailPass.length} characters (expected 16 for Gmail App Password)`
        );
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: emailUser,
          pass: emailPass,
        },
        connectionTimeout: 10000, // Increased timeout for deployment
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });

      await transporter.verify();
      emailCheckCompleted = true;
      if (timeoutId) clearTimeout(timeoutId); // Cancel timeout if verification succeeded
      console.log("✅ Email service configured and verified");
    } catch (error) {
      emailCheckCompleted = true;
      if (timeoutId) clearTimeout(timeoutId); // Cancel timeout if verification failed
      console.warn("\n⚠️  Email service verification failed:");
      if (
        error.message.includes("Application-specific password required") ||
        error.message.includes("Invalid login") ||
        error.code === "EAUTH"
      ) {
        console.warn("   Gmail requires an App Password when 2FA is enabled.");
        console.warn(
          "   Generate one at: https://myaccount.google.com/apppasswords"
        );
        console.warn(
          "   Update EMAIL_PASS in your .env file with the 16-character app password"
        );
        console.warn("   Make sure:");
        console.warn("   - 2FA is enabled on your Google account");
        console.warn(
          "   - You generated an App Password (not your regular password)"
        );
        console.warn("   - The password has no spaces or quotes in .env file");
        console.warn(
          `   - Current EMAIL_USER: ${process.env.EMAIL_USER || "NOT SET"}`
        );
        console.warn(
          `   - EMAIL_PASS length: ${
            process.env.EMAIL_PASS?.length || 0
          } characters`
        );
      } else if (
        error.message.includes("timeout") ||
        error.message.includes("Timeout")
      ) {
        console.warn(
          "   Connection timeout - email service may be slow or unreachable."
        );
        console.warn("   This is non-critical - server will continue running.");
        console.warn(
          "   Email verification will be attempted when sending emails."
        );
      } else {
        console.warn("   Error:", error.message);
        if (error.response) {
          console.warn("   Response:", error.response);
        }
      }
      console.warn(
        "   Bookings will still be created, but confirmation emails will not be sent\n"
      );
    }
  })();

  // Add a timeout to prevent blocking server startup
  timeoutId = setTimeout(() => {
    if (!emailCheckCompleted) {
      console.warn(
        "   Email verification taking too long - skipping (non-blocking)\n"
      );
    }
  }, 12000); // 12 second max wait

  // Wait for email check, but don't block if it takes too long
  try {
    await Promise.race([
      emailCheckPromise,
      new Promise((resolve) => setTimeout(resolve, 12000)),
    ]);
  } catch (error) {
    // Already handled in emailCheckPromise
  }
};

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Check email configuration (non-blocking)
checkEmailConfig();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "Restaurant Booking API",
    version: "1.0.0",
    endpoints: {
      bookings: "/api/bookings",
      weather: "/api/weather/:date",
      health: "/api/health",
    },
  });
});

// Health check endpoint
app.get("/api/health", async (req, res) => {
  const healthStatus = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      server: "running",
      mongodb: "unknown",
      email: "unknown",
    },
  };

  // Check MongoDB connection
  try {
    const mongoose = require("mongoose");
    const dbState = mongoose.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (dbState === 1) {
      healthStatus.services.mongodb = "connected";
    } else if (dbState === 2) {
      healthStatus.services.mongodb = "connecting";
    } else {
      healthStatus.services.mongodb = "disconnected";
      healthStatus.status = "degraded";
    }
  } catch (error) {
    healthStatus.services.mongodb = "error";
    healthStatus.status = "degraded";
  }

  // Check email configuration
  try {
    const emailUser = process.env.EMAIL_USER?.trim();
    const emailPass = process.env.EMAIL_PASS?.trim();
    const restaurantEmail = process.env.RESTAURANT_EMAIL?.trim();

    if (emailUser && emailPass && restaurantEmail) {
      // Try to verify email service (quick check)
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: emailUser,
          pass: emailPass,
        },
        connectionTimeout: 2000,
        greetingTimeout: 2000,
      });

      try {
        await Promise.race([
          transporter.verify(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 2000)
          ),
        ]);
        healthStatus.services.email = "configured";
      } catch (error) {
        healthStatus.services.email = "misconfigured";
        healthStatus.status = "degraded";
      }
    } else {
      healthStatus.services.email = "not_configured";
      healthStatus.status = "degraded";
    }
  } catch (error) {
    healthStatus.services.email = "error";
    healthStatus.status = "degraded";
  }

  const statusCode = healthStatus.status === "ok" ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

app.use("/api/bookings", bookingsRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/livekit", livekitRoutes);
app.use("/api/tools", toolsRoutes);
app.use("/api/conversations", conversationsRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
