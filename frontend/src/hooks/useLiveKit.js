import { useState, useEffect, useCallback, useRef } from "react";
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  Track,
  DataPacket_Kind,
} from "livekit-client";
import { getLiveKitConfig } from "../utils/livekitConfig";
import { getAnonId } from "../utils/anonId";

// Shared cleanup for a room, used whether the user clicks disconnect, the
// agent ends the call remotely, or the connection just drops.
const cleanupRoom = async (targetRoom) => {
  if (!targetRoom) return;
  if (targetRoom._speechRecognition) {
    targetRoom._speechRecognition.stop();
    delete targetRoom._speechRecognition;
  }
  if (targetRoom._agentAudioElements) {
    targetRoom._agentAudioElements.forEach((audioEl) => {
      audioEl.pause();
      audioEl.srcObject = null;
    });
    delete targetRoom._agentAudioElements;
  }
  try {
    await targetRoom.disconnect();
  } catch (e) {
    // already disconnected
  }
};

export const useLiveKit = () => {
  const [room, setRoom] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [agentState, setAgentState] = useState(null); // "thinking", "ready_to_speak", "waiting_for_user", "processing"
  const [agentStateMessage, setAgentStateMessage] = useState(null); // Context message
  const [isUserExpectedToSpeak, setIsUserExpectedToSpeak] = useState(false);
  const [options, setOptions] = useState([]); // Selectable options from agent
  const [optionsMessage, setOptionsMessage] = useState(null); // Message with options
  const [currentSpeech, setCurrentSpeech] = useState(""); // Current text being spoken
  const [booking, setBooking] = useState(null); // Confirmed booking details from agent
  const [conversationId, setConversationId] = useState(null); // Backend record for this session
  const [remoteMicCommand, setRemoteMicCommand] = useState(null); // Agent's requested mic state: { enabled, nonce }
  const [isViewingHistory, setIsViewingHistory] = useState(false); // True while showing a past, read-only conversation

  // Avoid saving a conversation record we just loaded for viewing back over itself
  const conversationIdRef = useRef(null);
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // The DataReceived handler below is a closure created once per connect()
  // call, so it can't read live `transcript` state directly (it would only
  // ever see the empty array from the render it was created in). Keep a ref
  // in sync instead, for the duplicate-check the handler needs to do.
  const transcriptRef = useRef([]);
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const connect = useCallback(async () => {
    if (isConnecting || isConnected) return;

    try {
      setIsConnecting(true);
      setError(null);
      // Starting a fresh live session - clear anything we were viewing/showing
      setIsViewingHistory(false);
      setTranscript([]);
      setBooking(null);
      setConversationId(null);

      const config = getLiveKitConfig();
      const anonId = getAnonId();

      // Generate a unique room name and participant name
      const roomName = `restaurant-booking-${Date.now()}`;
      const participantName = `user-${Date.now()}`;

      // Fetch JWT token from backend
      const tokenResponse = await fetch(
        `${config.backendUrl}/api/livekit/token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roomName,
            participantName,
          }),
        }
      );

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error(errorData.error || "Failed to get access token");
      }

      const { token } = await tokenResponse.json();

      if (!token) {
        throw new Error("No token received from server");
      }

      // Start a conversation history record for this session (best-effort -
      // the live call still works fine if this fails, it just won't be saved)
      try {
        const convoResponse = await fetch(
          `${config.backendUrl}/api/conversations`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ anonId, roomName }),
          }
        );
        if (convoResponse.ok) {
          const { data } = await convoResponse.json();
          setConversationId(data._id);
        }
      } catch (convoError) {
        console.warn("Could not start conversation history record:", convoError);
      }

      // Create a new room
      const newRoom = new Room();

      // Set up event listeners
      newRoom.on(RoomEvent.Connected, () => {
        console.log("Connected to LiveKit room");
        setIsConnected(true);
        setIsConnecting(false);
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        console.log("Disconnected from LiveKit room");
        setIsConnected(false);
        setIsConnecting(false);
        setIsAgentTyping(false);
        setAgentState(null);
        setAgentStateMessage(null);
        setIsUserExpectedToSpeak(false);
        setOptions([]);
        setOptionsMessage(null);
        setCurrentSpeech("");
        // Transcript and booking deliberately survive a disconnect (whether
        // the user clicked disconnect or the agent ended the call) so the
        // chat stays visible afterward.

        // Mark the conversation record ended, regardless of who disconnected.
        if (conversationIdRef.current) {
          const { backendUrl } = getLiveKitConfig();
          fetch(`${backendUrl}/api/conversations/${conversationIdRef.current}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "ended" }),
          }).catch(() => {});
        }
      });

      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log("Participant connected:", participant.identity);
      });

      newRoom.on(
        RoomEvent.TrackSubscribed,
        (track, publication, participant) => {
          if (
            track.kind === Track.Kind.Audio &&
            participant instanceof RemoteParticipant
          ) {
            // Agent audio track subscribed - agent is about to speak
            console.log("🔊 [FRONTEND] Agent audio track subscribed");
            console.log(
              `   Track ID: ${track.sid}, Participant: ${participant.identity}`
            );
            setIsAgentTyping(true);

            // Attach audio track to an audio element for playback
            // LiveKit tracks need to be attached to an HTMLAudioElement or HTMLVideoElement
            const audioElement = new Audio();
            audioElement.autoplay = true;
            audioElement.playsInline = true;

            // Add logging for audio element events
            audioElement.addEventListener("loadstart", () => {
              console.log("🔊 [FRONTEND] Audio element: loadstart");
            });
            audioElement.addEventListener("loadeddata", () => {
              console.log("🔊 [FRONTEND] Audio element: loadeddata");
            });
            audioElement.addEventListener("canplay", () => {
              console.log("🔊 [FRONTEND] Audio element: canplay");
            });
            audioElement.addEventListener("play", () => {
              console.log("🔊 [FRONTEND] Audio element: play event");
            });
            audioElement.addEventListener("playing", () => {
              console.log("🔊 [FRONTEND] Audio element: playing");
            });
            audioElement.addEventListener("pause", () => {
              console.log("🔊 [FRONTEND] Audio element: pause");
            });
            audioElement.addEventListener("ended", () => {
              console.log("🔊 [FRONTEND] Audio element: ended");
            });
            audioElement.addEventListener("error", (e) => {
              console.error("🔊 [FRONTEND] Audio element error:", e);
            });

            // Attach the track to the audio element
            track.attach(audioElement);

            // Store reference for cleanup
            if (!newRoom._agentAudioElements) {
              newRoom._agentAudioElements = [];
            }
            newRoom._agentAudioElements.push(audioElement);

            console.log(
              "✅ [FRONTEND] Agent audio track attached to audio element"
            );

            // Ensure audio plays
            audioElement.play().catch((err) => {
              console.warn("🔊 [FRONTEND] Audio autoplay prevented:", err);
            });

            // Listen for when track actually starts playing
            track.on("started", () => {
              console.log("🔊 [FRONTEND] Agent audio track started playing");
              console.log(`   Track ID: ${track.sid}, Muted: ${track.isMuted}`);
              setIsAgentTyping(false);
              setIsAgentSpeaking(true); // Agent is now speaking
              // Clear ready_to_speak state when audio actually starts
              setAgentState((prevState) => {
                if (prevState === "ready_to_speak") {
                  return null;
                }
                return prevState;
              });
              setAgentStateMessage(null);
            });

            track.on("ended", () => {
              console.log("🔊 [FRONTEND] Agent audio track ended");
              console.log(`   Track ID: ${track.sid}`);
              setIsAgentTyping(false);
              setIsAgentSpeaking(false); // Agent finished speaking
              // Set waiting_for_user state when agent finishes speaking
              setAgentState("waiting_for_user");
              setAgentStateMessage("Waiting for your response...");
              setIsUserExpectedToSpeak(true);
            });

            // Also listen for when track is muted/unmuted
            track.on("muted", () => {
              setIsAgentSpeaking(false);
            });

            track.on("unmuted", () => {
              setIsAgentSpeaking(true);
            });
          }
        }
      );

      // Listen for data channel messages (transcripts and state updates from agent)
      newRoom.on(
        RoomEvent.DataReceived,
        (payload, participant, kind, topic) => {
          if (participant instanceof RemoteParticipant) {
            // This is from the agent
            try {
              const text = new TextDecoder().decode(payload);
              if (text && text.trim()) {
                // Try to parse as JSON first
                try {
                  const data = JSON.parse(text);

                  // Handle state updates
                  if (data.type === "state_update") {
                    console.log(
                      "State update received:",
                      data.state,
                      data.message
                    );
                    setAgentState(data.state);
                    setAgentStateMessage(data.message || null);
                    // Update user expected to speak based on state
                    setIsUserExpectedToSpeak(data.state === "waiting_for_user");
                    // If agent is thinking or processing, show typing indicator
                    if (
                      data.state === "thinking" ||
                      data.state === "processing" ||
                      data.state === "ready_to_speak"
                    ) {
                      setIsAgentTyping(true);
                    } else {
                      setIsAgentTyping(false);
                    }
                    return;
                  }

                  // Handle options
                  if (data.type === "options") {
                    console.log(
                      "Options received:",
                      data.options,
                      data.message
                    );
                    setOptions(data.options || []);
                    setOptionsMessage(data.message || null);
                    return;
                  }

                  // Handle a confirmed booking
                  if (data.type === "booking_confirmed") {
                    console.log("Booking confirmation received:", data.booking);
                    setBooking(data.booking || null);
                    if (conversationIdRef.current && data.booking?.bookingId) {
                      const { backendUrl } = getLiveKitConfig();
                      fetch(
                        `${backendUrl}/api/conversations/${conversationIdRef.current}`,
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            bookingId: data.booking.bookingId,
                          }),
                        }
                      ).catch(() => {});
                    }
                    return;
                  }

                  // Handle current speech
                  if (data.type === "current_speech") {
                    console.log("Current speech received:", data.text);
                    setCurrentSpeech(data.text || "");
                    return;
                  }

                  // Handle the agent requesting the mic be turned on/off
                  if (data.type === "mic_control") {
                    console.log("Mic control received:", data.enabled);
                    setRemoteMicCommand({
                      enabled: !!data.enabled,
                      nonce: Date.now(),
                    });
                    return;
                  }

                  // Handle the agent ending the call
                  if (data.type === "end_session") {
                    console.log("Agent ended the session");
                    cleanupRoom(newRoom);
                    return;
                  }

                  // Handle transcript messages - ONLY accept our manual transcripts (type: "transcript")
                  // This ensures we only show what's logged in the terminal (🔊 [AGENT] and 💬 [USER])
                  if (data.type === "transcript") {
                    const transcriptText = data.text;
                    const speaker = data.speaker || "agent";
                    if (transcriptText) {
                      // Agent message received, hide typing indicator
                      setIsAgentTyping(false);
                      // Clear ready_to_speak state when transcript is received
                      setAgentState((prevState) => {
                        if (prevState === "ready_to_speak") {
                          return null;
                        }
                        return prevState;
                      });
                      setAgentStateMessage(null);

                      // Check for duplicates before adding - read from the
                      // ref, not a flag set inside the updater below (that
                      // updater isn't guaranteed to run synchronously, so a
                      // closure variable it sets can't be trusted on the
                      // next line - this bit the mic auto-control below).
                      const isDuplicate = transcriptRef.current.some(
                        (entry) =>
                          entry.speaker === speaker &&
                          entry.text === transcriptText
                      );

                      if (!isDuplicate) {
                        const newEntry = {
                          speaker,
                          text: transcriptText,
                          timestamp: new Date(),
                        };
                        setTranscript((prev) => [...prev, newEntry]);

                        // Deterministic mic auto-control, keyed off the turn
                        // actually completing (this transcript message), not
                        // audio playback events - those didn't prove
                        // reliable to depend on in testing. The agent's own
                        // set_microphone tool (handled above, data.type ===
                        // "mic_control") is still honored if the LLM does
                        // call it; this is just the reliable default so the
                        // mic reliably follows whose turn it is either way.
                        setRemoteMicCommand({
                          enabled: speaker === "agent",
                          nonce: Date.now(),
                        });
                      }
                    }
                    return; // Don't process other message types
                  }
                } catch (parseError) {
                  // Not JSON - ignore non-JSON messages
                  // We only accept structured JSON messages with type: "transcript" from our agent
                  // This prevents LiveKit's automatic transcripts from being processed
                }
              }
            } catch (e) {
              console.error("Error processing data channel message:", e);
            }
          }
        }
      );

      // Connect to room using JWT token
      await newRoom.connect(config.url, token);

      setRoom(newRoom);

      // Set up Web Speech API for user transcript capture
      if (
        "webkitSpeechRecognition" in window ||
        "SpeechRecognition" in window
      ) {
        const SpeechRecognition =
          window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = "en-US"; // Force English-only speech recognition
        recognition.maxAlternatives = 1; // Only return the best match

        recognition.onresult = (event) => {
          // Don't add user transcripts here - they come from the agent via data channel
          // The agent processes user input and sends it as a transcript, matching what's in the terminal
          const last = event.results.length - 1;
          const text = event.results[last][0].transcript;
          if (text && text.trim()) {
            console.log(
              "🎤 [FRONTEND] User speech recognized (for logging only):",
              text.trim()
            );
            // Transcript will be added by agent via data channel after processing
          }
        };

        recognition.onerror = (event) => {
          console.error("🎤 [FRONTEND] Speech recognition error:", event.error);
        };

        recognition.onstart = () => {
          console.log("🎤 [FRONTEND] Speech recognition started");
        };

        recognition.onend = () => {
          console.log("🎤 [FRONTEND] Speech recognition ended");
        };

        recognition.start();

        // Store recognition in room for cleanup
        newRoom._speechRecognition = recognition;
      }
    } catch (err) {
      console.error("LiveKit connection error:", err);
      setError(err.message);
      setIsConnecting(false);
    }
  }, [isConnecting, isConnected]);

  const disconnect = useCallback(async () => {
    if (room) {
      await cleanupRoom(room);
      setRoom(null);
      // Transcript and booking are deliberately left as-is here - the
      // RoomEvent.Disconnected handler above covers resetting connection
      // state and marking the conversation record ended either way.
    }
  }, [room]);

  const addTranscriptEntry = useCallback((speaker, text) => {
    setTranscript((prev) => [
      ...prev,
      { speaker, text, timestamp: new Date() },
    ]);
  }, []);

  const sendTextMessage = useCallback(
    async (text) => {
      if (!room || !isConnected || !text.trim()) {
        return;
      }

      try {
        // Don't add to transcript here - agent will send it via data channel
        // This ensures we only show what's logged in the terminal

        // Send message to agent via data channel
        const messageData = JSON.stringify({
          type: "user_message",
          text: text.trim(),
          timestamp: new Date().toISOString(),
        });

        await room.localParticipant.publishData(
          new TextEncoder().encode(messageData),
          DataPacket_Kind.RELIABLE
        );

        console.log("✅ Text message sent to agent:", text.trim());
      } catch (error) {
        console.error("Error sending text message:", error);
        setError(`Failed to send message: ${error.message}`);
      }
    },
    [room, isConnected]
  );

  const sendOptionSelection = useCallback(
    async (option) => {
      if (!room || !isConnected || !option) {
        return;
      }

      try {
        // Clear options after selection
        setOptions([]);
        setOptionsMessage(null);

        // Don't add to transcript here - agent will send it via data channel
        // This ensures we only show what's logged in the terminal

        // Send option selection to agent via data channel
        const messageData = JSON.stringify({
          type: "option_selected",
          option: option,
          timestamp: new Date().toISOString(),
        });

        await room.localParticipant.publishData(
          new TextEncoder().encode(messageData),
          DataPacket_Kind.RELIABLE
        );

        console.log("✅ Option selection sent to agent:", option);
      } catch (error) {
        console.error("Error sending option selection:", error);
        setError(`Failed to send option: ${error.message}`);
      }
    },
    [room, isConnected]
  );

  // Load a past, read-only conversation from history onto the landing page
  const loadConversation = useCallback(async (id) => {
    try {
      const { backendUrl } = getLiveKitConfig();
      const response = await fetch(`${backendUrl}/api/conversations/${id}`);
      if (!response.ok) throw new Error("Failed to load conversation");
      const { data } = await response.json();
      setTranscript(data.transcript || []);
      setBooking(null);
      setConversationId(null); // read-only view, don't let new events save over it
      setIsViewingHistory(true);
    } catch (err) {
      console.error("Error loading conversation history:", err);
      setError("Couldn't load that conversation");
    }
  }, []);

  const closeHistoryView = useCallback(() => {
    setIsViewingHistory(false);
    setTranscript([]);
    setBooking(null);
  }, []);

  // Persist the transcript as it grows, for the currently active (not
  // history-viewing) conversation.
  useEffect(() => {
    if (!conversationId || isViewingHistory || transcript.length === 0) return;
    const { backendUrl } = getLiveKitConfig();
    fetch(`${backendUrl}/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    }).catch(() => {});
  }, [transcript, conversationId, isViewingHistory]);

  useEffect(() => {
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);

  return {
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
    conversationId,
    remoteMicCommand,
    isViewingHistory,
    connect,
    disconnect,
    addTranscriptEntry,
    sendTextMessage,
    sendOptionSelection,
    loadConversation,
    closeHistoryView,
  };
};
