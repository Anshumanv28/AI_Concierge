import React from "react";
import { useLiveKit } from "./hooks/useLiveKit";
import VoiceInterface from "./components/VoiceInterface";
import Conversation from "./components/Conversation";
import BookingConfirmation from "./components/BookingConfirmation";
import CurrentSpeech from "./components/CurrentSpeech";
import {
  colors,
  shadows,
  borderRadius,
  transitions,
  gradients,
} from "./utils/styles";
import { useResponsive } from "./hooks/useResponsive";

function App() {
  const {
    room,
    isConnected,
    isConnecting,
    error,
    transcript,
    isAgentTyping,
    isAgentSpeaking,
    agentState,
    agentStateMessage,
    isUserExpectedToSpeak,
    options,
    optionsMessage,
    currentSpeech,
    booking,
    connect,
    disconnect,
    sendTextMessage,
    sendOptionSelection,
  } = useLiveKit();
  const { isMobile, isTablet } = useResponsive();

  const handleConnect = async () => {
    await connect();
  };

  const handleDisconnect = async () => {
    await disconnect();
  };

  // App container style
  const appContainerStyle = {
    minHeight: "100vh",
    background: gradients["baby-blue-ice-light"],
    display: "flex",
    flexDirection: "column",
  };

  // Header style
  const headerStyle = {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    backdropFilter: "blur(8px)",
    boxShadow: shadows.md,
    position: "sticky",
    top: 0,
    zIndex: 50,
  };

  const headerContentStyle = {
    maxWidth: "1280px",
    margin: "0 auto",
    padding: isMobile ? "1rem" : isTablet ? "1rem 1.5rem" : "1rem 2rem",
  };

  const titleStyle = {
    fontSize: isMobile ? "1.5rem" : isTablet ? "2rem" : "2.25rem",
    fontWeight: 700,
    background: gradients["text-gradient"],
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    margin: 0,
  };

  const subtitleStyle = {
    fontSize: isMobile ? "0.75rem" : "0.875rem",
    color: colors["rosy-taupe"][700],
    marginTop: "0.25rem",
    margin: 0,
  };

  // Main content style
  const mainStyle = {
    maxWidth: "1280px",
    margin: "0 auto",
    padding: isMobile ? "1rem" : isTablet ? "1.5rem" : "2rem",
    width: "100%",
    flex: 1,
  };

  // Connection section style
  const connectionSectionStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "200px",
    marginBottom: "2rem",
  };

  // Connect button style
  const connectButtonStyle = {
    padding: isMobile ? "0.75rem 1.5rem" : "1rem 2rem",
    background: gradients["baby-blue-ice"],
    color: "white",
    fontWeight: 600,
    borderRadius: borderRadius.xl,
    boxShadow: shadows.lg,
    border: "none",
    cursor: "pointer",
    fontSize: isMobile ? "0.875rem" : "1rem",
    transition: `all ${transitions.normal} ease-in-out`,
    outline: "none",
  };

  // Connecting spinner style
  const connectingContainerStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1rem",
  };

  const spinnerStyle = {
    width: isMobile ? "2.5rem" : "3rem",
    height: isMobile ? "2.5rem" : "3rem",
    border: `4px solid ${colors["baby-blue-ice"][200]}`,
    borderTop: `4px solid ${colors["baby-blue-ice"][500]}`,
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  };

  const connectingTextStyle = {
    color: colors["baby-blue-ice"][700],
    fontWeight: 500,
    fontSize: isMobile ? "0.875rem" : "1rem",
  };

  // Connected status style
  const connectedContainerStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1rem",
  };

  const connectedStatusStyle = {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    color: colors.aquamarine[600],
  };

  const statusDotStyle = {
    width: "12px",
    height: "12px",
    backgroundColor: colors.aquamarine[500],
    borderRadius: "50%",
    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
  };

  const statusTextStyle = {
    fontWeight: 600,
    fontSize: isMobile ? "0.875rem" : "1rem",
  };

  // Disconnect button style
  const disconnectButtonStyle = {
    padding: isMobile ? "0.5rem 1rem" : "0.625rem 1.25rem",
    backgroundColor: colors["rosy-taupe"][500],
    color: "white",
    fontWeight: 500,
    borderRadius: borderRadius.lg,
    border: "none",
    cursor: "pointer",
    fontSize: isMobile ? "0.875rem" : "0.9375rem",
    transition: `background-color ${transitions.normal} ease-in-out`,
    outline: "none",
  };

  // Error message style
  const errorContainerStyle = {
    marginTop: "1rem",
    padding: "1rem",
    backgroundColor: colors["blush-rose"][50],
    border: `1px solid ${colors["blush-rose"][300]}`,
    borderRadius: borderRadius.lg,
    maxWidth: "28rem",
  };

  const errorTextStyle = {
    color: colors["blush-rose"][700],
    fontWeight: 500,
    fontSize: isMobile ? "0.875rem" : "0.9375rem",
  };

  // Grid layout style
  const gridLayoutStyle = {
    display: "grid",
    gridTemplateColumns: isMobile || isTablet ? "1fr" : "1fr 2fr",
    gap: isMobile ? "1rem" : "1.5rem",
    width: "100%",
  };

  // Right column style
  const rightColumnStyle = {
    display: "flex",
    flexDirection: "column",
    gap: isMobile ? "1rem" : "1.5rem",
  };

  return (
    <div style={appContainerStyle}>
      {/* Header */}
      <header style={headerStyle}>
        <div style={headerContentStyle}>
          <h1 style={titleStyle}>Restaurant Voice Booking Agent</h1>
          <p style={subtitleStyle}>
            Book your table through natural conversation
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main style={mainStyle}>
        {/* Connection Section */}
        <div style={connectionSectionStyle}>
          {!isConnected && !isConnecting && (
            <button
              onClick={handleConnect}
              style={connectButtonStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow = shadows.xl;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = shadows.lg;
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = `3px solid ${colors["baby-blue-ice"][300]}`;
                e.currentTarget.style.outlineOffset = "2px";
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = "none";
              }}
              aria-label="Connect to voice booking agent"
            >
              Connect to Agent
            </button>
          )}

          {isConnecting && (
            <div style={connectingContainerStyle}>
              <div style={spinnerStyle} aria-label="Connecting" />
              <p style={connectingTextStyle}>Connecting to agent...</p>
            </div>
          )}

          {isConnected && (
            <div style={connectedContainerStyle}>
              <div style={connectedStatusStyle}>
                <div style={statusDotStyle} aria-hidden="true" />
                <span style={statusTextStyle}>Connected</span>
              </div>
              <button
                onClick={handleDisconnect}
                style={disconnectButtonStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    colors["rosy-taupe"][600];
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    colors["rosy-taupe"][500];
                }}
                onFocus={(e) => {
                  e.currentTarget.style.outline = `3px solid ${colors["rosy-taupe"][300]}`;
                  e.currentTarget.style.outlineOffset = "2px";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.outline = "none";
                }}
                aria-label="Disconnect from voice booking agent"
              >
                Disconnect
              </button>
            </div>
          )}

          {error && (
            <div style={errorContainerStyle} role="alert">
              <p style={errorTextStyle}>Error: {error}</p>
            </div>
          )}
        </div>

        {/* Voice Interface and Conversation */}
        {isConnected && (
          <div style={gridLayoutStyle}>
            {/* Voice Interface - Left Side */}
            <div>
              <VoiceInterface
                room={room}
                isConnected={isConnected}
                isAgentSpeaking={isAgentSpeaking}
                agentState={agentState}
                agentStateMessage={agentStateMessage}
                isUserExpectedToSpeak={isUserExpectedToSpeak}
                onTranscriptUpdate={(entry) => {
                  // This will be handled by the conversation component
                }}
              />
            </div>

            {/* Conversation and Booking Confirmation - Right Side */}
            <div style={rightColumnStyle}>
              <Conversation
                transcript={transcript}
                isAgentTyping={isAgentTyping}
                isAgentSpeaking={isAgentSpeaking}
                agentState={agentState}
                agentStateMessage={agentStateMessage}
                isUserExpectedToSpeak={isUserExpectedToSpeak}
                options={options}
                optionsMessage={optionsMessage}
                onSendMessage={sendTextMessage}
                onSelectOption={sendOptionSelection}
                isConnected={isConnected}
              />
              {booking && <BookingConfirmation booking={booking} />}
            </div>
          </div>
        )}

        {/* Current Speech Display */}
        <CurrentSpeech
          text={currentSpeech}
          isVisible={isConnected && currentSpeech}
        />
      </main>
    </div>
  );
}

export default App;
