<p align="center">
  <img src="resources/readme-banner.gif" alt="Cawal turns spoken words into text on your laptop" width="100%">
</p>

# <img src="resources/icon.png" width="36" height="36" alt=""> Cawal

**Voice dictation for Windows. Speak, press a shortcut, and keep writing.**

Cawal transcribes your voice and pastes the result into the app you're using.
Built for everyday Indonesian speech, with support for mixed English wording and tech terms.
Powered by Groq. Bring your own API key.

[**Download for Windows**](https://github.com/widisaadi/cangkem-virtual/releases/download/v1.7.10/Cawal-Setup-1.7.10.exe)
· [Releases](https://github.com/widisaadi/cangkem-virtual/releases)
· [User guide](docs/usage.md)
· [Report an issue](https://github.com/widisaadi/cangkem-virtual/issues)

## Features

- **Dictate in your apps** — transcribe and paste without switching windows.
- **Choose your shortcut** — press once to record, again to finish; Esc cancels.
- **Polish with AI** — optional punctuation and paragraph cleanup.
- **Indonesian + English** — keeps conversational wording, English phrases and AI terms intact.
- **Stay out of the way** — a small recording indicator and a system tray app.
- **Set up in minutes** — guided onboarding, microphone selection, and optional Windows startup.

## Get started

Requires **Windows x64**, an internet connection, and a [Groq API key](https://console.groq.com/keys).

1. Download and run `Cawal-Setup-1.7.10.exe` from [Releases](https://github.com/widisaadi/cangkem-virtual/releases/latest).
2. Open Cawal and follow the setup to save your API key and choose a shortcut.
3. Click a text field in any app. Press your shortcut, speak, then press it again.

The default shortcut is **Ctrl + Shift + Space**. Check **General** for your active
shortcut or to change it. Closing the settings window keeps Cawal running in the tray.

The installer is unsigned, so Windows may show an unknown-publisher warning.

## Privacy

Your API key is encrypted on your device. The microphone is active only while
recording. Audio is sent to Groq for transcription; enabling AI polishing also
sends the transcript to Groq. Cawal does not save recordings or transcript history
to disk and includes no telemetry. Copied text remains in the Windows clipboard.

No Cawal account or app subscription is required. Groq's API limits and charges
apply to your own account. See the [user guide](docs/usage.md) for details.

## Development

Requires Windows x64, **Node.js 24+**, and .NET Framework 4.x.

```powershell
npm ci
npm run dev
```

```powershell
npm run check         # Type checking, tests, and renderer build
npm run test:desktop  # Desktop smoke test with simulated audio and API responses
npm run build:win     # Build the Windows installer
```

Built with Electron, React, and TypeScript, plus a native Windows paste helper.
See [development notes](docs/development.md) for the project structure.

## Credits & license

Cawal is a focused adaptation of [OpenWhispr](https://github.com/OpenWhispr/openwhispr).
The Windows paste helper also adapts its terminal detection and focus recovery.

Released under the [MIT License](LICENSE), retaining the original OpenWhispr notices.
