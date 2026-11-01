import React from "react";
import { colors, borderRadius, transitions, fonts } from "../utils/styles";
import { useResponsive } from "../hooks/useResponsive";

const OptionSelector = ({ options, message, onSelect, isVisible }) => {
  const { isMobile } = useResponsive();
  const [hoveredIndex, setHoveredIndex] = React.useState(null);

  if (!isVisible || !options || options.length === 0) {
    return null;
  }

  const containerStyle = {
    backgroundColor: colors.paper[50],
    border: `1px solid ${colors.paper[300]}`,
    borderRadius: borderRadius.md,
    padding: isMobile ? "0.75rem" : "1rem",
    marginTop: "0.75rem",
  };

  const messageStyle = {
    fontFamily: fonts.label,
    fontSize: "0.8125rem",
    color: colors.ink[600],
    marginBottom: "0.75rem",
  };

  const optionsContainerStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  };

  const getOptionButtonStyle = (isHovered) => ({
    fontFamily: fonts.display,
    width: "100%",
    padding: isMobile ? "0.625rem 0.875rem" : "0.6875rem 1rem",
    borderRadius: borderRadius.sm,
    border: `1px solid ${isHovered ? colors.accent[700] : colors.paper[400]}`,
    backgroundColor: isHovered ? colors.accent[100] : colors.paper[50],
    color: colors.ink[900],
    fontSize: isMobile ? "0.875rem" : "0.9375rem",
    cursor: "pointer",
    transition: `background-color ${transitions.normal} ease-in-out, border-color ${transitions.normal} ease-in-out, color ${transitions.normal} ease-in-out`,
    textAlign: "left",
    outline: "none",
  });

  return (
    <div style={containerStyle}>
      {message && <p style={messageStyle}>{message}</p>}
      <div style={optionsContainerStyle}>
        {options.map((option, index) => (
          <button
            key={index}
            onClick={() => onSelect && onSelect(option)}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            style={getOptionButtonStyle(hoveredIndex === index)}
            onFocus={(e) => {
              e.currentTarget.style.outline = `2px solid ${colors.accent[700]}`;
              e.currentTarget.style.outlineOffset = "2px";
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = "none";
            }}
            aria-label={`Select option: ${option}`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
};

export default OptionSelector;
