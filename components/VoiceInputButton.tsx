"use client"

// ============================================================
// VoiceInputButton — the "LocalVoice" feature.
// Browser Web Speech API only (no external library). Default language en-IN
// (Indian English — important for Bengaluru place names). Hides itself
// entirely when SpeechRecognition is unavailable (Firefox, some mobile).
//
// Web Speech API types aren't in the standard DOM lib, so we declare a minimal
// local interface for the webkit-prefixed API (no @types/web-speech-api).
// ============================================================

import { useEffect, useRef, useState } from "react"
import { Mic, Loader2, Check } from "lucide-react"

// --- Minimal local typings for the Web Speech API ---
interface SpeechRecognitionResultItem {
  transcript: string
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionResultItem
  isFinal: boolean
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}
interface SpeechRecognitionCtor {
  new (): SpeechRecognitionLike
}
interface SpeechWindow {
  SpeechRecognition?: SpeechRecognitionCtor
  webkitSpeechRecognition?: SpeechRecognitionCtor
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as SpeechWindow
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export interface VoiceInputButtonProps {
  onTranscript: (text: string) => void
  language?: string
}

type State = "idle" | "listening" | "done"

export function VoiceInputButton({
  onTranscript,
  language = "en-IN",
}: VoiceInputButtonProps) {
  const [supported, setSupported] = useState(false)
  const [state, setState] = useState<State>("idle")
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const finalRef = useRef("")

  // Availability check runs client-side only.
  useEffect(() => {
    setSupported(getRecognitionCtor() !== null)
  }, [])

  useEffect(() => {
    // Cleanup: stop any active recognition on unmount.
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  if (!supported) return null // graceful fallback: hide entirely

  function start() {
    const Ctor = getRecognitionCtor()
    if (!Ctor) return
    const recognition = new Ctor()
    recognition.lang = language
    recognition.continuous = false
    recognition.interimResults = false
    finalRef.current = ""

    recognition.onresult = (event) => {
      let transcript = ""
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result && result.isFinal) transcript += result[0].transcript
      }
      finalRef.current = transcript.trim()
    }
    recognition.onend = () => {
      setState(finalRef.current ? "done" : "idle")
      if (finalRef.current) onTranscript(finalRef.current)
      recognitionRef.current = null
      // Reset the checkmark back to idle after a beat.
      if (finalRef.current) {
        window.setTimeout(() => setState("idle"), 1500)
      }
    }
    recognition.onerror = () => {
      setState("idle")
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    setState("listening")
    recognition.start()
  }

  function toggle() {
    if (state === "listening") {
      recognitionRef.current?.stop() // clicking while listening stops it
    } else {
      start()
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={state === "listening" ? "Stop voice input" : "Describe by voice"}
      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
        state === "listening"
          ? "bg-red-500 text-white"
          : state === "done"
            ? "bg-emerald-500 text-white"
            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {state === "idle" && (
        <>
          <Mic className="h-4 w-4" /> Speak
        </>
      )}
      {state === "listening" && (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="animate-pulse">Listening…</span>
        </>
      )}
      {state === "done" && (
        <>
          <Check className="h-4 w-4" /> Got it
        </>
      )}
    </button>
  )
}

export default VoiceInputButton
