import React from "react";
import { colors, borderRadius, fonts } from "../utils/styles";
import { useResponsive } from "../hooks/useResponsive";

const CurrentSpeech = ({ text, isVisible }) => {
  const { isMobile } = useResponsive();

  if (!isVisible || !text || text.trim() === "") {
    return null;
  }

  // Container style - fixed at bottom of viewport; the one floating element,
  // justified because it carries the thing happening right now
  const containerStyle = {
    position: "fixed",
    bottom: isMobile ? "1rem" : "1.5rem",
    left: "50%",
    transform: "translateX(-50%)",
    maxWidth: isMobile ? "90%" : "720px",
    width: "100%",
    zIndex: 100,
    backgroundColor: colors.paper[50],
    border: `1px solid ${colors.accent[700]}`,
    borderRadius: borderRadius.md,
    padding: isMobile ? "0.625rem 0.875rem" : "0.75rem 1.25rem",
  };

  const labelStyle = {
    fontFamily: fonts.label,
    fontSize: "0.6875rem",
    fontWeight: 600,
    color: colors.accent[700],
    marginBottom: "0.375rem",
  };

  const textStyle = {
    fontFamily: fonts.display,
    fontSize: isMobile ? "0.875rem" : "0.9375rem",
    color: colors.ink[900],
    lineHeight: 1.6,
  };

  return (
    <div style={containerStyle}>
      <div style={labelStyle}>agent speaking</div>
      <div style={textStyle}>{text}</div>
    </div>
  );
};

export default CurrentSpeech;
