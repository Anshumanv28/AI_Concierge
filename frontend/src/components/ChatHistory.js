import React, { useEffect, useState } from "react";
import { colors, borderRadius, fonts } from "../utils/styles";
import { useResponsive } from "../hooks/useResponsive";
import { getLiveKitConfig } from "../utils/livekitConfig";
import { getAnonId } from "../utils/anonId";

const ChatHistory = ({ onSelectConversation }) => {
  const { isMobile } = useResponsive();
  const [conversations, setConversations] = useState([]);
  const [loadState, setLoadState] = useState("loading"); // "loading" | "ready" | "error"

  useEffect(() => {
    const load = async () => {
      try {
        const { backendUrl } = getLiveKitConfig();
        const anonId = getAnonId();
        const response = await fetch(
          `${backendUrl}/api/conversations?anonId=${encodeURIComponent(anonId)}`
        );
        if (!response.ok) throw new Error("Failed to load history");
        const { data } = await response.json();
        setConversations(data || []);
        setLoadState("ready");
      } catch (err) {
        console.error("Error loading chat history:", err);
        setLoadState("error");
      }
    };
    load();
  }, []);

  const formatWhen = (iso) => {
    try {
      return new Date(iso).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const containerStyle = {
    width: "100%",
    maxWidth: "640px",
    margin: "2rem auto 0",
  };

  const headerStyle = {
    fontFamily: fonts.label,
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: colors.ink[700],
    marginBottom: "0.75rem",
    paddingBottom: "0.5rem",
    borderBottom: `1px solid ${colors.paper[300]}`,
  };

  const listStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  };

  const itemStyle = {
    fontFamily: fonts.display,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "0.75rem",
    width: "100%",
    textAlign: "left",
    padding: isMobile ? "0.625rem 0.75rem" : "0.75rem 1rem",
    backgroundColor: colors.paper[50],
    border: `1px solid ${colors.paper[300]}`,
    borderRadius: borderRadius.sm,
    cursor: "pointer",
  };

  const previewStyle = {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: isMobile ? "0.8125rem" : "0.875rem",
    color: colors.ink[900],
  };

  const metaStyle = {
    fontFamily: fonts.label,
    fontSize: "0.6875rem",
    color: colors.ink[500],
    flexShrink: 0,
  };

  const emptyStyle = {
    fontFamily: fonts.label,
    fontSize: "0.8125rem",
    color: colors.ink[500],
    textAlign: "center",
    padding: "1rem",
  };

  if (loadState === "loading") return null;
  if (loadState === "error") return null;
  if (conversations.length === 0) return null;

  return (
    <div style={containerStyle}>
      <h2 style={headerStyle}>CHAT HISTORY</h2>
      {conversations.length === 0 ? (
        <p style={emptyStyle}>No past conversations on this browser yet.</p>
      ) : (
        <div style={listStyle}>
          {conversations.map((c) => (
            <button
              key={c._id}
              style={itemStyle}
              onClick={() => onSelectConversation(c._id)}
              onFocus={(e) => {
                e.currentTarget.style.outline = `2px solid ${colors.accent[700]}`;
                e.currentTarget.style.outlineOffset = "2px";
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = "none";
              }}
              aria-label={`View conversation from ${formatWhen(c.startedAt)}`}
            >
              <span style={previewStyle}>
                {c.preview || "(no messages)"}
                {c.hasBooking ? " · booked" : ""}
              </span>
              <span style={metaStyle}>{formatWhen(c.startedAt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatHistory;
