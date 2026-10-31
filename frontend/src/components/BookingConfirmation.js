import React from "react";
import { colors, shadows, borderRadius, gradients } from "../utils/styles";
import { useResponsive } from "../hooks/useResponsive";

const BookingConfirmation = ({ booking }) => {
  const { isMobile } = useResponsive();

  if (!booking) return null;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Kolkata",
    });
  };

  // Container style
  const containerStyle = {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    backdropFilter: "blur(8px)",
    borderRadius: borderRadius["2xl"],
    boxShadow: shadows.lg,
    padding: isMobile ? "1rem" : "1.5rem",
    animation: "fadeIn 0.5s ease-out forwards",
  };

  // Header style
  const headerStyle = {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "1.5rem",
  };

  const iconContainerStyle = {
    width: isMobile ? "2.5rem" : "3rem",
    height: isMobile ? "2.5rem" : "3rem",
    backgroundColor: colors.aquamarine[100],
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const iconStyle = {
    width: isMobile ? "1.25rem" : "1.5rem",
    height: isMobile ? "1.25rem" : "1.5rem",
    color: colors.aquamarine[600],
  };

  const titleStyle = {
    fontSize: isMobile ? "1.25rem" : "1.5rem",
    fontWeight: 700,
    color: colors.aquamarine[700],
    margin: 0,
  };

  // Details container
  const detailsContainerStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  };

  // Grid style
  const gridStyle = {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
    gap: "1rem",
  };

  // Detail card style
  const getDetailCardStyle = (colorName) => ({
    backgroundColor: colors[colorName][50],
    borderRadius: borderRadius.lg,
    padding: isMobile ? "0.75rem" : "1rem",
    border: `1px solid ${colors[colorName][200]}`,
  });

  const labelStyle = {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: colors["baby-blue-ice"][700],
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    display: "block",
    marginBottom: "0.25rem",
  };

  const valueStyle = {
    fontSize: isMobile ? "0.875rem" : "1rem",
    fontWeight: 700,
    color: colors["baby-blue-ice"][900],
    margin: 0,
  };

  const valueStyleSmall = {
    fontSize: isMobile ? "0.8125rem" : "0.875rem",
    fontWeight: 600,
    color: colors["vintage-berry"][900],
    margin: 0,
  };

  // Additional details container
  const additionalDetailsStyle = {
    backgroundColor: colors.gray[50], // Using CSS variable
    borderRadius: borderRadius.lg,
    padding: isMobile ? "0.75rem" : "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  };

  const detailRowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  };

  const detailLabelStyle = {
    fontSize: "0.875rem",
    fontWeight: 500,
    color: colors.gray[700], // Using CSS variable
  };

  const detailValueStyle = {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: colors.gray[900], // Using CSS variable
    textTransform: "capitalize",
  };

  // Status badge style
  const getStatusBadgeStyle = (status) => {
    const baseStyle = {
      fontSize: "0.75rem",
      fontWeight: 600,
      padding: "0.25rem 0.75rem",
      borderRadius: borderRadius.full,
    };

    if (status === "confirmed") {
      return {
        ...baseStyle,
        backgroundColor: colors.aquamarine[100],
        color: colors.aquamarine[700],
      };
    } else if (status === "pending") {
      return {
        ...baseStyle,
        backgroundColor: colors["baby-blue-ice"][100],
        color: colors["baby-blue-ice"][700],
      };
    } else {
      return {
        ...baseStyle,
        backgroundColor: colors["rosy-taupe"][100],
        color: colors["rosy-taupe"][700],
      };
    }
  };

  // Weather container style
  const weatherContainerStyle = {
    background: gradients["baby-blue-ice-light"], // Using centralized gradient
    borderRadius: borderRadius.lg,
    padding: isMobile ? "0.75rem" : "1rem",
    border: `1px solid ${colors["baby-blue-ice"][200]}`,
  };

  const weatherTitleStyle = {
    fontSize: "0.875rem",
    fontWeight: 700,
    color: colors["baby-blue-ice"][800],
    marginBottom: "0.5rem",
    margin: 0,
  };

  const weatherTextStyle = {
    fontSize: "0.875rem",
    color: colors["baby-blue-ice"][700],
    margin: 0,
  };

  return (
    <div style={containerStyle} role="region" aria-label="Booking confirmation">
      {/* Success Header */}
      <div style={headerStyle}>
        <div style={iconContainerStyle} aria-hidden="true">
          <svg
            style={iconStyle}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 style={titleStyle}>Booking Confirmed!</h3>
      </div>

      {/* Booking Details */}
      <div style={detailsContainerStyle}>
        <div style={gridStyle}>
          <div style={getDetailCardStyle("baby-blue-ice")}>
            <span style={labelStyle}>Booking ID</span>
            <p style={valueStyle}>{booking.bookingId}</p>
          </div>

          <div style={getDetailCardStyle("aquamarine")}>
            <span style={labelStyle}>Number of Guests</span>
            <p style={valueStyle}>{booking.numberOfGuests}</p>
          </div>

          <div style={getDetailCardStyle("vintage-berry")}>
            <span style={labelStyle}>Date</span>
            <p style={valueStyleSmall}>{formatDate(booking.bookingDate)}</p>
          </div>

          <div style={getDetailCardStyle("blush-rose")}>
            <span style={labelStyle}>Time</span>
            <p style={valueStyle}>{booking.bookingTime}</p>
          </div>
        </div>

        {/* Additional Details */}
        <div style={additionalDetailsStyle}>
          {booking.cuisinePreference && (
            <div style={detailRowStyle}>
              <span style={detailLabelStyle}>Cuisine:</span>
              <span style={detailValueStyle}>{booking.cuisinePreference}</span>
            </div>
          )}

          <div style={detailRowStyle}>
            <span style={detailLabelStyle}>Seating:</span>
            <span style={detailValueStyle}>{booking.seatingPreference}</span>
          </div>

          <div style={detailRowStyle}>
            <span style={detailLabelStyle}>Status:</span>
            <span style={getStatusBadgeStyle(booking.status)}>
              {booking.status}
            </span>
          </div>
        </div>

        {/* Weather Info */}
        {booking.weatherInfo && (
          <div style={weatherContainerStyle}>
            <h4 style={weatherTitleStyle}>Weather Forecast</h4>
            <p style={weatherTextStyle}>
              {booking.weatherInfo.description} -{" "}
              {booking.weatherInfo.temperature}°C
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingConfirmation;
