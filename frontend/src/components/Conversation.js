import React, { useEffect, useRef, useState } from "react";
import { colors, borderRadius, fonts } from "../utils/styles";
import { useResponsive } from "../hooks/useResponsive";
import OptionSelector from "./OptionSelector";

const Conversation = ({
  transcript,
  isAgentTyping,
  isAgentSpeaking,
  agentState,
  agentStateMessage,
  isUserExpectedToSpeak,
  options,
  optionsMessage,
  onSendMessage,
  onSelectOption,
  isConnected,
}) => {
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const [inputValue, setInputValue] = useState("");
  const { isMobile, isTablet } = useResponsive();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, isAgentTyping]);

  const handleSendMessage = () => {
    if (inputValue.trim() && onSendMessage) {
      onSendMessage(inputValue.trim());
      setInputValue("");
    }
  };

  const containerStyle = {
    backgroundColor: colors.paper[50],
    border: `1px solid ${colors.paper[300]}`,
    borderRadius: borderRadius.md,
    padding: isMobile ? "0.875rem" : "1.125rem",
    height: isMobile ? "400px" : isTablet ? "480px" : "560px",
    display: "flex",
    flexDirection: "column",
    width: "100%",
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

  const messagesContainerStyle = {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    paddingRight: "0.25rem",
    marginBottom: isConnected ? "0.75rem" : "0",
  };

  const emptyStateStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  };

  const emptyStateTextStyle = {
    fontFamily: fonts.label,
    color: colors.ink[500],
    textAlign: "center",
    fontSize: "0.875rem",
  };

  const getMessageContainerStyle = (speaker) => ({
    display: "flex",
    justifyContent: speaker === "user" ? "flex-end" : "flex-start",
  });

  // Message bubble style — flat, one hue reserved for the user's own turn
  const getMessageBubbleStyle = (speaker) => {
    const isUser = speaker === "user";
    return {
      maxWidth: isMobile ? "88%" : "78%",
      borderRadius: borderRadius.sm,
      padding: isMobile ? "0.625rem 0.875rem" : "0.75rem 1rem",
      backgroundColor: isUser ? colors.ink[900] : colors.paper[100],
      border: isUser ? "none" : `1px solid ${colors.paper[300]}`,
      color: isUser ? colors.paper[50] : colors.ink[900],
    };
  };

  const messageHeaderStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "0.25rem",
  };

  const speakerNameStyle = {
    fontFamily: fonts.label,
    fontSize: "0.6875rem",
    fontWeight: 600,
    opacity: 0.75,
  };

  const timestampStyle = {
    fontFamily: fonts.label,
    fontSize: "0.6875rem",
    opacity: 0.6,
    marginLeft: "0.5rem",
  };

  const messageTextStyle = {
    fontFamily: fonts.display,
    fontSize: isMobile ? "0.875rem" : "0.9375rem",
    lineHeight: 1.55,
  };

  const typingContainerStyle = {
    display: "flex",
    justifyContent: "flex-start",
  };

  // Typing indicator bubble — agent states read as ink + the status hue, not a rainbow of fills
  const getTypingBubbleStyle = (state) => {
    const baseStyle = {
      borderRadius: borderRadius.sm,
      padding: isMobile ? "0.625rem 0.875rem" : "0.75rem 1rem",
      border: `1px solid ${colors.paper[300]}`,
      backgroundColor: colors.paper[100],
      color: colors.ink[900],
    };

    if (state === "thinking" || state === "ready_to_speak" || state === "processing") {
      return {
        ...baseStyle,
        borderColor: colors.warning[600],
      };
    }
    return baseStyle;
  };

  const typingDotsStyle = {
    display: "flex",
    gap: "0.25rem",
    alignItems: "center",
    marginTop: "0.375rem",
  };

  const getTypingDotStyle = (delay, color) => ({
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: color || colors.ink[500],
    animation: `bounce 0.6s infinite alternate`,
    animationDelay: `${delay}s`,
  });

  const inputContainerStyle = {
    display: "flex",
    gap: "0.5rem",
    paddingTop: "0.75rem",
    borderTop: `1px solid ${colors.paper[300]}`,
    alignItems: "center",
  };

  const inputStyle = {
    fontFamily: fonts.display,
    flex: 1,
    padding: isMobile ? "0.625rem" : "0.6875rem 0.875rem",
    borderRadius: borderRadius.sm,
    border: `1px solid ${colors.paper[400]}`,
    fontSize: isMobile ? "0.875rem" : "0.9375rem",
    backgroundColor: colors.paper[50],
    color: colors.ink[900],
  };

  const sendButtonStyle = {
    fontFamily: fonts.label,
    padding: isMobile ? "0.625rem 1rem" : "0.6875rem 1.125rem",
    borderRadius: borderRadius.sm,
    border: `1px solid ${colors.accent[700]}`,
    backgroundColor: colors.accent[500],
    color: colors.accent.ink,
    fontSize: "0.8125rem",
    fontWeight: 700,
    cursor: isConnected && inputValue.trim() ? "pointer" : "not-allowed",
    opacity: isConnected && inputValue.trim() ? 1 : 0.5,
  };

  return (
    <div style={containerStyle}>
      <h3 style={headerStyle}>CONVERSATION</h3>

      <div style={messagesContainerStyle}>
        {transcript.length === 0 ? (
          <div style={emptyStateStyle}>
            <p style={emptyStateTextStyle}>
              start speaking to begin the conversation…
            </p>
          </div>
        ) : (
          <>
            {transcript.map((entry, index) => (
              <div key={index} style={getMessageContainerStyle(entry.speaker)}>
                <div style={getMessageBubbleStyle(entry.speaker)}>
                  <div style={messageHeaderStyle}>
                    <span style={speakerNameStyle}>
                      {entry.speaker === "user" ? "YOU" : "AGENT"}
                    </span>
                    <span style={timestampStyle}>
                      {entry.timestamp
                        ? new Date(entry.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                  </div>
                  <div style={messageTextStyle}>{entry.text}</div>
                </div>
              </div>
            ))}

            {/* Loading Indicators */}
            {isAgentTyping && agentState && (
              <div style={typingContainerStyle}>
                <div style={getTypingBubbleStyle(agentState)}>
                  <span style={speakerNameStyle}>AGENT</span>
                  <div style={messageTextStyle}>
                    {agentState === "thinking" && "agent is thinking…"}
                    {agentState === "ready_to_speak" &&
                      "agent is preparing to speak…"}
                    {agentState === "processing" &&
                      (agentStateMessage || "processing…")}
                  </div>
                  <div style={typingDotsStyle}>
                    <div
                      style={getTypingDotStyle(0, colors.warning[600])}
                      aria-hidden="true"
                    />
                    <div
                      style={getTypingDotStyle(0.15, colors.warning[600])}
                      aria-hidden="true"
                    />
                    <div
                      style={getTypingDotStyle(0.3, colors.warning[600])}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* User Should Speak Indicator */}
            {isUserExpectedToSpeak && !isAgentSpeaking && (
              <div style={typingContainerStyle}>
                <div
                  style={{
                    borderRadius: borderRadius.sm,
                    padding: isMobile ? "0.625rem 0.875rem" : "0.75rem 1rem",
                    backgroundColor: colors.accent[100],
                    border: `1px solid ${colors.accent[700]}`,
                    color: colors.accent[900],
                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                  }}
                >
                  <span style={speakerNameStyle}>SYSTEM</span>
                  <div style={messageTextStyle}>please speak…</div>
                  <div style={typingDotsStyle}>
                    <div
                      style={getTypingDotStyle(0, colors.accent[700])}
                      aria-hidden="true"
                    />
                    <div
                      style={getTypingDotStyle(0.2, colors.accent[700])}
                      aria-hidden="true"
                    />
                    <div
                      style={getTypingDotStyle(0.4, colors.accent[700])}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Options Selector */}
            {options && options.length > 0 && (
              <OptionSelector
                options={options}
                message={optionsMessage}
                onSelect={onSelectOption}
                isVisible={true}
              />
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Text Input Panel */}
      {isConnected && (
        <div style={inputContainerStyle}>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && inputValue.trim()) {
                handleSendMessage();
              }
            }}
            placeholder={
              isAgentSpeaking
                ? "agent is speaking…"
                : "type your message here (or speak)…"
            }
            style={inputStyle}
            disabled={!isConnected || isAgentSpeaking}
            aria-label="Message to the booking agent"
          />
          <button
            onClick={handleSendMessage}
            disabled={!isConnected || !inputValue.trim() || isAgentSpeaking}
            style={sendButtonStyle}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = colors.accent[300];
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.accent[500];
            }}
          >
            SEND
          </button>
        </div>
      )}
    </div>
  );
};

export default Conversation;
