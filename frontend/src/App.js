import React from "react";
import { useLiveKit } from "./hooks/useLiveKit";
import VoiceInterface from "./components/VoiceInterface";
import Conversation from "./components/Conversation";
import BookingConfirmation from "./components/BookingConfirmation";
import CurrentSpeech from "./components/CurrentSpeech";
import ChatHistory from "./components/ChatHistory";
import { colors, borderRadius, transitions, fonts } from "./utils/styles";
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
    remoteMicCommand,
    isViewingHistory,
    connect,
    disconnect,
    sendTextMessage,
    sendOptionSelection,
    loadConversation,
    closeHistoryView,
  } = useLiveKit();
  const { isMobile, isTablet } = useResponsive();

  const handleConnect = async () => {
    await connect();
  };

  const handleDisconnect = async () => {
    await disconnect();
  };

  // A transcript is shown either while live, right after a call just ended
  // (the chat stays visible), or while browsing a past conversation.
  const showingTranscript = isConnected || transcript.length > 0;
  const showHistoryList = !isConnected && !isConnecting && !showingTranscript;

  const appContainerStyle = {
    minHeight: "100vh",
    background: colors.paper[100],
    display: "flex",
    flexDirection: "column",
  };

  const headerStyle = {
    backgroundColor: colors.paper[50],
    borderBottom: `1px solid ${colors.paper[300]}`,
    position: "sticky",
    top: 0,
    zIndex: 50,
  };

  const headerContentStyle = {
    maxWidth: "1152px",
    margin: "0 auto",
    padding: isMobile ? "0.75rem 1rem" : "0.75rem 1.5rem",
    display: "flex",
    alignItems: "baseline",
    gap: "0.75rem",
  };

  const markStyle = {
    fontFamily: fonts.display,
    fontWeight: 700,
    fontSize: isMobile ? "1.125rem" : "1.25rem",
    color: colors.accent[700],
  };

  const titleStyle = {
    fontFamily: fonts.display,
    fontSize: isMobile ? "1rem" : "1.125rem",
    fontWeight: 700,
    color: colors.ink[900],
    margin: 0,
  };

  const subtitleStyle = {
    fontFamily: fonts.label,
    fontSize: "0.75rem",
    color: colors.ink[500],
    margin: 0,
  };

  const mainStyle = {
    maxWidth: "1152px",
    margin: "0 auto",
    padding: isMobile ? "1rem" : isTablet ? "1.25rem" : "1.5rem",
    width: "100%",
    flex: 1,
  };

  const connectionSectionStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "160px",
    marginBottom: "1.5rem",
  };

  const connectButtonStyle = {
    fontFamily: fonts.display,
    padding: isMobile ? "0.625rem 1.25rem" : "0.75rem 1.5rem",
    backgroundColor: colors.accent[500],
    color: colors.accent.ink,
    fontWeight: 700,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.accent[700]}`,
    cursor: "pointer",
    fontSize: isMobile ? "0.875rem" : "0.9375rem",
    transition: `background-color ${transitions.normal} ease-in-out`,
    outline: "none",
  };

  const connectingContainerStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.75rem",
  };

  const spinnerStyle = {
    width: "1.75rem",
    height: "1.75rem",
    border: `3px solid ${colors.paper[300]}`,
    borderTop: `3px solid ${colors.accent[500]}`,
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  };

  const connectingTextStyle = {
    fontFamily: fonts.label,
    color: colors.ink[600],
    fontSize: "0.875rem",
  };

  const connectedContainerStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.75rem",
  };

  const connectedStatusStyle = {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  };

  const statusDotStyle = {
    width: "8px",
    height: "8px",
    backgroundColor: colors.accent[500],
    borderRadius: "50%",
    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
  };

  const statusTextStyle = {
    fontFamily: fonts.label,
    color: colors.ink[700],
    fontWeight: 600,
    fontSize: "0.8125rem",
    letterSpacing: "0.02em",
  };

  const disconnectButtonStyle = {
    fontFamily: fonts.label,
    padding: "0.4rem 0.875rem",
    backgroundColor: "transparent",
    color: colors.ink[700],
    fontWeight: 600,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.paper[400]}`,
    cursor: "pointer",
    fontSize: "0.8125rem",
    transition: `border-color ${transitions.normal} ease-in-out`,
    outline: "none",
  };

  const backButtonStyle = {
    ...disconnectButtonStyle,
  };

  const errorContainerStyle = {
    marginTop: "0.75rem",
    padding: "0.75rem 1rem",
    backgroundColor: colors.danger[100],
    borderRadius: borderRadius.md,
    maxWidth: "28rem",
  };

  const errorTextStyle = {
    fontFamily: fonts.label,
    color: colors.danger[700],
    fontWeight: 600,
    fontSize: "0.8125rem",
  };

  const gridLayoutStyle = {
    display: "grid",
    gridTemplateColumns: isMobile || isTablet ? "1fr" : "360px 1fr",
    gap: isMobile ? "1rem" : "1rem",
    width: "100%",
  };

  const singleColumnStyle = {
    maxWidth: "720px",
    margin: "0 auto",
    width: "100%",
  };

  const rightColumnStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  };

  return (
    <div style={appContainerStyle}>
      <header style={headerStyle}>
        <div style={headerContentStyle}>
          <span style={markStyle} aria-hidden="true">
            {">_"}
          </span>
          <div>
            <h1 style={titleStyle}>Restaurant Voice Booking Agent</h1>
            <p style={subtitleStyle}>book a table by talking to it</p>
          </div>
        </div>
      </header>

      <main style={mainStyle}>
        <div style={connectionSectionStyle}>
          {!isConnected && !isConnecting && !showingTranscript && (
            <button
              onClick={handleConnect}
              style={connectButtonStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.accent[300];
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = colors.accent[500];
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = `2px solid ${colors.accent[700]}`;
                e.currentTarget.style.outlineOffset = "2px";
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = "none";
              }}
              aria-label="Connect to voice booking agent"
            >
              connect_to_agent()
            </button>
          )}

          {isConnecting && (
            <div style={connectingContainerStyle}>
              <div style={spinnerStyle} aria-label="Connecting" />
              <p style={connectingTextStyle}>connecting to agent…</p>
            </div>
          )}

          {isConnected && (
            <div style={connectedContainerStyle}>
              <div style={connectedStatusStyle}>
                <div style={statusDotStyle} aria-hidden="true" />
                <span style={statusTextStyle}>CONNECTED</span>
              </div>
              <button
                onClick={handleDisconnect}
                style={disconnectButtonStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = colors.ink[700];
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = colors.paper[400];
                }}
                onFocus={(e) => {
                  e.currentTarget.style.outline = `2px solid ${colors.ink[700]}`;
                  e.currentTarget.style.outlineOffset = "2px";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.outline = "none";
                }}
                aria-label="Disconnect from voice booking agent"
              >
                disconnect()
              </button>
            </div>
          )}

          {!isConnected && !isConnecting && showingTranscript && (
            <div style={connectedContainerStyle}>
              <span style={statusTextStyle}>
                {isViewingHistory ? "PAST CONVERSATION" : "CALL ENDED"}
              </span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => {
                    closeHistoryView();
                  }}
                  style={backButtonStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = colors.ink[700];
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = colors.paper[400];
                  }}
                  aria-label="Back to chat history"
                >
                  ← back
                </button>
                <button
                  onClick={handleConnect}
                  style={connectButtonStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colors.accent[300];
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = colors.accent[500];
                  }}
                  aria-label="Start a new conversation"
                >
                  new_conversation()
                </button>
              </div>
            </div>
          )}

          {error && (
            <div style={errorContainerStyle} role="alert">
              <p style={errorTextStyle}>error: {error}</p>
            </div>
          )}
        </div>

        {showHistoryList && (
          <ChatHistory onSelectConversation={loadConversation} />
        )}

        {isConnected && (
          <div style={gridLayoutStyle}>
            <div>
              <VoiceInterface
                room={room}
                isConnected={isConnected}
                isAgentSpeaking={isAgentSpeaking}
                agentState={agentState}
                agentStateMessage={agentStateMessage}
                isUserExpectedToSpeak={isUserExpectedToSpeak}
                remoteMicCommand={remoteMicCommand}
                onTranscriptUpdate={(entry) => {
                  // This will be handled by the conversation component
                }}
              />
            </div>

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

        {!isConnected && showingTranscript && (
          <div style={singleColumnStyle}>
            <Conversation
              transcript={transcript}
              isAgentTyping={false}
              isAgentSpeaking={false}
              agentState={null}
              agentStateMessage={null}
              isUserExpectedToSpeak={false}
              options={[]}
              optionsMessage={null}
              onSendMessage={() => {}}
              onSelectOption={() => {}}
              isConnected={false}
            />
            {booking && <BookingConfirmation booking={booking} />}
          </div>
        )}

        <CurrentSpeech
          text={currentSpeech}
          isVisible={isConnected && currentSpeech}
        />
      </main>
    </div>
  );
}

export default App;
