"use client";

// ============================================================================
// Real speech capture for the coach — two engines, one interface.
// ----------------------------------------------------------------------------
// ENGINE A ("browser"): the Web Speech API. Zero install, no server, streams
//   interim results as you talk. This is the default because a demo that needs
//   a second process running is a demo that can fail on stage.
//
// ENGINE B ("whisper"): our own whisper-flow server (FastAPI + WebSocket,
//   /ws, raw int16 PCM @16kHz in, JSON transcripts out). Selected when
//   NEXT_PUBLIC_WHISPER_WS is set AND the socket actually opens. Runs fully
//   locally, so it keeps working with the venue wifi unplugged and never sends
//   audio to a third party — the privacy story.
//
// The hook probes B, silently falls back to A, and falls back again to plain
// typing if neither is available. The caller never branches on engine.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechEngine = "whisper" | "browser" | "none";

export interface SpeechState {
  supported: boolean;
  engine: SpeechEngine;
  listening: boolean;
  /** Text confirmed by the recogniser so far this session. */
  finalText: string;
  /** In-flight words, not yet confirmed. Render these greyed out. */
  interimText: string;
  error: string | null;
}

const WHISPER_WS = process.env.NEXT_PUBLIC_WHISPER_WS ?? "";
const TARGET_SAMPLE_RATE = 16000;

/** Downsample a Float32 buffer to 16kHz int16 PCM, which is what Whisper eats. */
function toPcm16(input: Float32Array, inputRate: number): ArrayBuffer {
  const ratio = inputRate / TARGET_SAMPLE_RATE;
  const outLength = Math.floor(input.length / ratio);
  const out = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    // Average the source window rather than point-sampling — cheap anti-alias.
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    const sample = end > start ? sum / (end - start) : 0;
    const clamped = Math.max(-1, Math.min(1, sample));
    out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return out.buffer;
}

export function useSpeech() {
  const [state, setState] = useState<SpeechState>({
    supported: false,
    engine: "none",
    listening: false,
    finalText: "",
    interimText: "",
    error: null,
  });

  // Browser-engine handle.
  const recognitionRef = useRef<any>(null);
  // Whisper-engine handles.
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // Capability probe. Runs once — decides which engine we advertise.
  useEffect(() => {
    const SR =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    const hasMic =
      typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

    if (WHISPER_WS && hasMic) {
      // Probe the whisper-flow server's readiness endpoint. If it answers we
      // prefer it; if anything at all goes wrong we quietly use the browser.
      const httpProbe = WHISPER_WS.replace(/^ws/, "http").replace(/\/ws$/, "") + "/ready";
      fetch(httpProbe, { signal: AbortSignal.timeout(1500) })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(() => setState((s) => ({ ...s, supported: true, engine: "whisper" })))
        .catch(() =>
          setState((s) => ({
            ...s,
            supported: Boolean(SR),
            engine: SR ? "browser" : "none",
          }))
        );
      return;
    }

    setState((s) => ({
      ...s,
      supported: Boolean(SR),
      engine: SR ? "browser" : "none",
    }));
  }, []);

  const stopWhisper = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    stopWhisper();
    setState((s) => ({ ...s, listening: false, interimText: "" }));
  }, [stopWhisper]);

  const start = useCallback(async () => {
    setState((s) => ({ ...s, finalText: "", interimText: "", error: null }));

    // ---- Engine B: whisper-flow -------------------------------------------
    if (state.engine === "whisper") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const ws = new WebSocket(WHISPER_WS);
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            // whisper-flow returns {data: {text}, is_partial} shaped payloads.
            const text: string = msg?.data?.text ?? msg?.text ?? "";
            if (!text.trim()) return;
            if (msg?.is_partial) {
              setState((s) => ({ ...s, interimText: text }));
            } else {
              setState((s) => ({
                ...s,
                finalText: (s.finalText + " " + text).trim(),
                interimText: "",
              }));
            }
          } catch {
            /* ignore malformed frames */
          }
        };
        ws.onerror = () =>
          setState((s) => ({ ...s, error: "Whisper server dropped — type instead." }));

        await new Promise<void>((resolve, reject) => {
          ws.onopen = () => resolve();
          setTimeout(() => reject(new Error("ws timeout")), 2000);
        });

        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        // ScriptProcessor is deprecated but universally available and needs no
        // separate worklet file — the right trade for a demo.
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          ws.send(toPcm16(e.inputBuffer.getChannelData(0), ctx.sampleRate));
        };
        source.connect(processor);
        processor.connect(ctx.destination);

        setState((s) => ({ ...s, listening: true }));
        return;
      } catch {
        stopWhisper();
        // fall through to the browser engine below
      }
    }

    // ---- Engine A: Web Speech API -----------------------------------------
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setState((s) => ({ ...s, error: "No microphone support — type instead." }));
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += chunk;
        else interim += chunk;
      }
      setState((s) => ({
        ...s,
        finalText: final ? (s.finalText + " " + final).trim() : s.finalText,
        interimText: interim,
      }));
    };
    recognition.onerror = (e: any) => {
      const msg =
        e?.error === "not-allowed"
          ? "Microphone blocked — allow access or type instead."
          : "Speech recognition hiccuped — type instead.";
      setState((s) => ({ ...s, error: msg, listening: false }));
    };
    recognition.onend = () => setState((s) => ({ ...s, listening: false }));

    try {
      recognition.start();
      setState((s) => ({ ...s, listening: true, engine: "browser" }));
    } catch {
      setState((s) => ({ ...s, error: "Could not start the mic.", listening: false }));
    }
  }, [state.engine, stopWhisper]);

  const reset = useCallback(
    () => setState((s) => ({ ...s, finalText: "", interimText: "", error: null })),
    []
  );

  useEffect(() => () => stop(), [stop]);

  return { ...state, start, stop, reset };
}
