import React, { useState, useEffect, useRef } from "react";
import { createLocalAudioTrack } from "livekit-client";
import { colors, borderRadius, transitions, fonts } from "../utils/styles";
import { useResponsive } from "../hooks/useResponsive";

const VoiceInterface = ({
  room,
  isConnected,
  isAgentSpeaking,
  agentState,
  agentStateMessage,
  isUserExpectedToSpeak,
  onTranscriptUpdate,
}) => {
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [micError, setMicError] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevels, setAudioLevels] = useState([0, 0, 0, 0, 0]);
  const localTrackRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  const { isMobile } = useResponsive();

  // Analyze audio levels for equalizer visualization
  useEffect(() => {
    if (!isMicEnabled || !localTrackRef.current) {
      setIsSpeaking(false);
      setAudioLevels([0, 0, 0, 0, 0]);
      return;
    }

    const analyzeAudio = async () => {
      try {
        const stream = localTrackRef.current.mediaStream;
        if (!stream) return;

        const audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);

        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.85; // Smoother transitions
        source.connect(analyser);

        analyserRef.current = analyser;
        audioContextRef.current = audioContext;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateLevels = () => {
          if (!analyserRef.current) return;

          analyserRef.current.getByteFrequencyData(dataArray);

          // Get average levels for 5 frequency bands
          const bandSize = Math.floor(dataArray.length / 5);
          const levels = [];
          let maxLevel = 0;

          for (let i = 0; i < 5; i++) {
            let sum = 0;
            for (let j = 0; j < bandSize; j++) {
              sum += dataArray[i * bandSize + j];
            }
            const avg = sum / bandSize;
            levels.push(avg);
            maxLevel = Math.max(maxLevel, avg);
          }

          // Normalize to 0-100 with smoother scaling
          const normalizedLevels = levels.map((level) =>
            Math.min(100, (level / 255) * 100)
          );
          setAudioLevels(normalizedLevels);

          // Consider speaking if any level is above threshold
          setIsSpeaking(maxLevel > 30);

          animationFrameRef.current = requestAnimationFrame(updateLevels);
        };

        updateLevels();
      } catch (error) {
        console.error("Error analyzing audio:", error);
      }
    };

    analyzeAudio();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      analyserRef.current = null;
      audioContextRef.current = null;
    };
  }, [isMicEnabled]);

  useEffect(() => {
    if (!room || !isConnected) return;

    const enableMic = async () => {
      try {
        setMicError(null);
        const track = await createLocalAudioTrack();
        await room.localParticipant.publishTrack(track);
        localTrackRef.current = track;
        setIsMicEnabled(true);
        console.log("Microphone enabled successfully");
      } catch (error) {
        console.error("Error enabling microphone:", error);
        let errorMessage = "Failed to enable microphone";

        if (
          error.name === "NotAllowedError" ||
          error.message?.includes("permission")
        ) {
          errorMessage =
            "Microphone permission denied. Please allow microphone access in your browser settings.";
        } else if (
          error.name === "NotFoundError" ||
          error.message?.includes("device")
        ) {
          errorMessage =
            "No microphone found. Please connect a microphone and try again.";
        } else if (error.message) {
          errorMessage = error.message;
        }

        setMicError(errorMessage);
        setIsMicEnabled(false);
      }
    };

    enableMic();

    return () => {
      if (
        localTrackRef.current &&
        typeof localTrackRef.current.stop === "function"
      ) {
        try {
          localTrackRef.current.stop();
        } catch (error) {
          console.warn("Error stopping track in cleanup:", error);
        }
        localTrackRef.current = null;
      }
    };
  }, [room, isConnected]);

  const toggleMic = async () => {
    if (!room || !isConnected || isAgentSpeaking) return; // Don't allow toggling while agent is speaking

    try {
      setMicError(null);
      if (isMicEnabled) {
        // Disable mic
        const tracks = room.localParticipant.audioTracks;
        for (const [, publication] of tracks) {
          if (publication && publication.track) {
            try {
              await room.localParticipant.unpublishTrack(publication.track);
              if (typeof publication.track.stop === "function") {
                publication.track.stop();
              }
            } catch (error) {
              console.warn("Error unpublishing track:", error);
            }
          }
        }
        if (
          localTrackRef.current &&
          typeof localTrackRef.current.stop === "function"
        ) {
          try {
            localTrackRef.current.stop();
          } catch (error) {
            console.warn("Error stopping local track:", error);
          }
          localTrackRef.current = null;
        }
        setIsMicEnabled(false);
        setIsSpeaking(false);
        setAudioLevels([0, 0, 0, 0, 0]);
        console.log("Microphone disabled");
      } else {
        // Enable mic
        const track = await createLocalAudioTrack();
        await room.localParticipant.publishTrack(track);
        localTrackRef.current = track;
        setIsMicEnabled(true);
        console.log("Microphone enabled");
      }
    } catch (error) {
      console.error("Error toggling microphone:", error);
      let errorMessage = "Failed to toggle microphone";

      if (
        error.name === "NotAllowedError" ||
        error.message?.includes("permission")
      ) {
        errorMessage =
          "Microphone permission denied. Please allow microphone access in your browser settings.";
      } else if (
        error.name === "NotFoundError" ||
        error.message?.includes("device")
      ) {
        errorMessage =
          "No microphone found. Please connect a microphone and try again.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      setMicError(errorMessage);
      setIsMicEnabled(false);
    }
  };

  // Container styles
  const containerStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: isMobile ? "1.25rem" : "1.5rem",
    backgroundColor: colors.paper[50],
    border: `1px solid ${colors.paper[300]}`,
    borderRadius: borderRadius.md,
    width: "100%",
  };

  // Button container
  const buttonContainerStyle = {
    position: "relative",
    marginBottom: "0.75rem",
  };

  // Button base style
  const getButtonStyle = () => {
    const baseStyle = {
      position: "relative",
      zIndex: 10,
      width: isMobile ? "56px" : "68px",
      height: isMobile ? "56px" : "68px",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: `1px solid ${colors.paper[400]}`,
      cursor: isConnected ? "pointer" : "not-allowed",
      transition: `background-color ${transitions.slow} ease-in-out, border-color ${transitions.slow} ease-in-out`,
      outline: "none",
    };

    if (micError) {
      return {
        ...baseStyle,
        backgroundColor: colors.danger[600],
        borderColor: colors.danger[700],
        color: colors.paper[50],
      };
    }

    if (!isConnected) {
      return {
        ...baseStyle,
        backgroundColor: colors.paper[200],
        color: colors.ink[500],
      };
    }

    if (isMicEnabled) {
      if (isSpeaking) {
        return {
          ...baseStyle,
          backgroundColor: colors.accent[500],
          borderColor: colors.accent[700],
          color: colors.accent.ink,
        };
      } else if (isUserExpectedToSpeak && !isAgentSpeaking) {
        return {
          ...baseStyle,
          backgroundColor: colors.accent[100],
          borderColor: colors.accent[700],
          color: colors.accent[900],
          animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        };
      } else {
        return {
          ...baseStyle,
          backgroundColor: colors.accent[300],
          borderColor: colors.accent[700],
          color: colors.accent.ink,
        };
      }
    }

    return {
      ...baseStyle,
      backgroundColor: colors.paper[200],
      color: colors.ink[500],
    };
  };

  // Equalizer container
  const equalizerContainerStyle = {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: "3px",
    height: "32px",
    marginBottom: "0.75rem",
    width: "100%",
  };

  // Equalizer bar style — one hue, intensity via opacity
  const getBarStyle = (level) => {
    const height = Math.max(8, level);
    const opacity = Math.min(1, level / 50 + 0.35);

    return {
      width: isMobile ? "5px" : "6px",
      height: `${height}%`,
      minHeight: "6px",
      backgroundColor: colors.accent[700],
      opacity,
      transition: `height ${transitions.fast} ease-out, opacity ${transitions.fast} ease-out`,
    };
  };

  // Status text style
  const statusTextStyle = {
    fontFamily: fonts.label,
    textAlign: "center",
    fontSize: "0.8125rem",
  };

  return (
    <div style={containerStyle}>
      {/* Microphone Button with Voice Activity Indicator */}
      <div style={buttonContainerStyle}>
        <button
          onClick={toggleMic}
          disabled={!isConnected || isAgentSpeaking}
          style={getButtonStyle()}
          onMouseEnter={(e) => {
            if (isConnected && !micError) {
              e.currentTarget.style.borderColor = colors.ink[700];
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = getButtonStyle().borderColor;
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = `2px solid ${colors.accent[700]}`;
            e.currentTarget.style.outlineOffset = "2px";
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = "none";
          }}
          title={isMicEnabled ? "Mute microphone" : "Enable microphone"}
          aria-label={isMicEnabled ? "Mute microphone" : "Enable microphone"}
          aria-pressed={isMicEnabled}
        >
          <svg
            width={isMobile ? "22" : "28"}
            height={isMobile ? "22" : "28"}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ pointerEvents: "none" }}
            aria-hidden="true"
          >
            {isMicEnabled ? (
              <path
                d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"
                fill="currentColor"
              />
            ) : (
              <path
                d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27 7.73 9H3v6h4c0 1.66 1.34 3 3 3s3-1.34 3-3v-1.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4c-.28 0-.5.22-.5.5v3.17l1 1V4.5c0-.28-.22-.5-.5-.5zm5.5 6.5c0 .28.22.5.5.5s.5-.22.5-.5-.22-.5-.5-.5-.5.22-.5.5z"
                fill="currentColor"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Equalizer Bars - Voice Activity Indicator */}
      {isMicEnabled && (
        <div
          style={equalizerContainerStyle}
          aria-label="Voice activity indicator"
        >
          {audioLevels.map((level, index) => (
            <div key={index} style={getBarStyle(level)} role="presentation" />
          ))}
        </div>
      )}

      {/* Status Text */}
      <div style={statusTextStyle}>
        {micError ? (
          <span style={{ color: colors.danger[600] }}>{micError}</span>
        ) : isConnected ? (
          isAgentSpeaking ? (
            <span style={{ color: colors.ink[600] }}>agent speaking…</span>
          ) : agentState === "thinking" ? (
            <span style={{ color: colors.warning[600] }}>
              agent thinking…
            </span>
          ) : agentState === "ready_to_speak" ? (
            <span style={{ color: colors.warning[600] }}>
              agent preparing to speak…
            </span>
          ) : agentState === "processing" ? (
            <span style={{ color: colors.warning[600] }}>
              {agentStateMessage || "processing…"}
            </span>
          ) : isUserExpectedToSpeak ? (
            <span
              style={{
                color: colors.accent[700],
                fontWeight: 600,
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
              }}
            >
              please speak…
            </span>
          ) : isMicEnabled ? (
            <span style={{ color: colors.ink[600] }}>
              {isSpeaking ? "listening…" : "microphone enabled"}
            </span>
          ) : (
            <span style={{ color: colors.ink[500] }}>microphone disabled</span>
          )
        ) : (
          <span style={{ color: colors.ink[500] }}>not connected</span>
        )}
      </div>
    </div>
  );
};

export default VoiceInterface;
