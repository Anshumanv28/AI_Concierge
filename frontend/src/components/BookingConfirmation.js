import React from "react";
import { colors, borderRadius, fonts } from "../utils/styles";
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

  const containerStyle = {
    backgroundColor: colors.paper[50],
    border: `1px solid ${colors.success[600]}`,
    borderRadius: borderRadius.md,
    padding: isMobile ? "1rem" : "1.25rem",
  };

  const headerStyle = {
    display: "flex",
    alignItems: "center",
    gap: "0.625rem",
    marginBottom: "1rem",
    paddingBottom: "0.75rem",
    borderBottom: `1px solid ${colors.paper[300]}`,
  };

  const iconStyle = {
    width: "1.125rem",
    height: "1.125rem",
    color: colors.success[600],
    flexShrink: 0,
  };

  const titleStyle = {
    fontFamily: fonts.display,
    fontSize: isMobile ? "1rem" : "1.125rem",
    fontWeight: 700,
    color: colors.ink[900],
    margin: 0,
  };

  // Detail grid — one card style, no per-field hue
  const detailsContainerStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "0.875rem",
  };

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
    gap: "0.75rem",
  };

  const fieldStyle = {};

  const labelStyle = {
    fontFamily: fonts.label,
    fontSize: "0.6875rem",
    fontWeight: 600,
    color: colors.ink[500],
    display: "block",
    marginBottom: "0.1875rem",
  };

  const valueStyle = {
    fontFamily: fonts.display,
    fontSize: isMobile ? "0.875rem" : "0.9375rem",
    fontWeight: 700,
    color: colors.ink[900],
    margin: 0,
  };

  // Additional details container
  const additionalDetailsStyle = {
    backgroundColor: colors.paper[100],
    borderRadius: borderRadius.sm,
    padding: isMobile ? "0.75rem" : "0.875rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.625rem",
  };

  const detailRowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  };

  const detailLabelStyle = {
    fontFamily: fonts.label,
    fontSize: "0.8125rem",
    color: colors.ink[600],
  };

  const detailValueStyle = {
    fontFamily: fonts.display,
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: colors.ink[900],
  };

  // Status badge style — the status set, used for exactly this
  const getStatusBadgeStyle = (status) => {
    const baseStyle = {
      fontFamily: fonts.label,
      fontSize: "0.6875rem",
      fontWeight: 600,
      padding: "0.1875rem 0.5rem",
      borderRadius: borderRadius.sm,
    };

    if (status === "confirmed") {
      return {
        ...baseStyle,
        backgroundColor: colors.success[100],
        color: colors.success[700],
      };
    } else if (status === "pending") {
      return {
        ...baseStyle,
        backgroundColor: colors.warning[100],
        color: colors.warning[700],
      };
    }
    return {
      ...baseStyle,
      backgroundColor: colors.danger[100],
      color: colors.danger[700],
    };
  };

  const weatherContainerStyle = {
    backgroundColor: colors.paper[100],
    borderRadius: borderRadius.sm,
    padding: isMobile ? "0.75rem" : "0.875rem",
  };

  const weatherTitleStyle = {
    fontFamily: fonts.label,
    fontSize: "0.6875rem",
    fontWeight: 600,
    color: colors.ink[500],
    marginBottom: "0.25rem",
    margin: 0,
  };

  const weatherTextStyle = {
    fontFamily: fonts.display,
    fontSize: "0.875rem",
    color: colors.ink[900],
    margin: 0,
  };

  return (
    <div style={containerStyle} role="region" aria-label="Booking confirmation">
      <div style={headerStyle}>
        <svg
          style={iconStyle}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        <h3 style={titleStyle}>Booking confirmed</h3>
      </div>

      <div style={detailsContainerStyle}>
        <div style={gridStyle}>
          <div style={fieldStyle}>
            <span style={labelStyle}>BOOKING ID</span>
            <p style={valueStyle}>{booking.bookingId}</p>
          </div>

          <div style={fieldStyle}>
            <span style={labelStyle}>GUESTS</span>
            <p style={valueStyle}>{booking.numberOfGuests}</p>
          </div>

          <div style={fieldStyle}>
            <span style={labelStyle}>DATE</span>
            <p style={valueStyle}>{formatDate(booking.bookingDate)}</p>
          </div>

          <div style={fieldStyle}>
            <span style={labelStyle}>TIME</span>
            <p style={valueStyle}>{booking.bookingTime}</p>
          </div>
        </div>

        {/* Additional Details */}
        <div style={additionalDetailsStyle}>
          {booking.cuisinePreference && (
            <div style={detailRowStyle}>
              <span style={detailLabelStyle}>cuisine</span>
              <span style={detailValueStyle}>{booking.cuisinePreference}</span>
            </div>
          )}

          <div style={detailRowStyle}>
            <span style={detailLabelStyle}>seating</span>
            <span style={detailValueStyle}>{booking.seatingPreference}</span>
          </div>

          <div style={detailRowStyle}>
            <span style={detailLabelStyle}>status</span>
            <span style={getStatusBadgeStyle(booking.status)}>
              {booking.status?.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Weather Info */}
        {booking.weatherInfo && (
          <div style={weatherContainerStyle}>
            <h4 style={weatherTitleStyle}>WEATHER FORECAST</h4>
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
