import { useEffect, useRef, useState } from 'react';
import { GearIcon, Link2Icon, Cross2Icon, MinusIcon, CheckIcon, ReloadIcon, InfoCircledIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import KeyField from './KeyField';
import Onboarding from './Onboarding';
import { createRecorder } from './recorder';
import { unwrap, busyPhases, labels, type Snapshot, type Settings } from './types';
import ShortcutEditor from './ShortcutEditor';
import RecordingPill from './RecordingPill';
import logo from '../resources/brand.png';

const api = window.cawal;
const isOverlay = new URLSearchParams(location.search).has('overlay');
function Logo() {
  return <img aria-hidden="true" className="logo" src={logo} alt="" />;
}
function SectionIcon({ kind }: { kind: 'voice' | 'writing' | 'windows' }) {
  return <span className="section-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{kind === 'voice' ? <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></> : kind === 'writing' ? <><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6" /></> : <><path d="M3 5l8-1v7H3zM14 4l7-1v8h-7zM3 14h8v7l-8-1zM14 14h7v8l-7-1z" /></>}</svg></span>;
}
function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled: boolean }) {
  return <button className="switch" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}><span /></button>;
}
export default function App() {
  const [state, setState] = useState<Snapshot | null>(null);
  const [tab, setTab] = useState<'general' | 'connection'>('general');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [key, setKey] = useState('');
  const [working, setWorking] = useState(false);
  const workingRef = useRef(false);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    document.documentElement.classList.toggle('overlay', isOverlay);
    if (!api) return;
    const unsubscribe = api.onState(setState);
    void unwrap(api.bootstrap()).then(value => { setState(value); if (!value.hasKey) setTab('connection'); }).catch(error => setError(error.message));
    if (isOverlay) return unsubscribe;
    // The hidden renderer owns microphone capture; the window is only settings.
    const recorder = createRecorder(api, () => {});
    const uncommand = api.onCommand(command => recorder.handle(command));
    return () => { unsubscribe(); uncommand(); recorder.dispose(); };
  }, []);
  useEffect(() => {
    if (isOverlay || !navigator.mediaDevices) return;
    const update = () => { void navigator.mediaDevices.enumerateDevices().then(devices => setMicrophones(devices.filter(device => device.kind === 'audioinput'))).catch(() => {}); };
    update(); navigator.mediaDevices.addEventListener('devicechange', update);
    return () => navigator.mediaDevices.removeEventListener('devicechange', update);
  }, [tab, state?.phase]);
  if (isOverlay) return state ? <RecordingPill state={state} /> : null;
  if (!api) return <div className="desktop-required"><Logo /><h1>Cawal</h1><p>Open the Cawal desktop app to configure dictation.</p></div>;
  const busy = state ? busyPhases.includes(state.phase) : false;
  const disabled = busy || working;
  async function perform(task: () => Promise<unknown>, message = '') {
    if (workingRef.current) return;
    workingRef.current = true; setWorking(true); setError(''); setNotice('');
    try { await task(); if (message) setNotice(message); }
    catch (error) { setError((error as Error).message); }
    finally { workingRef.current = false; setWorking(false); }
  }
  async function updateSettings(patch: Partial<Settings>) {
    if (api && state) setState(await unwrap(api.saveSettings({ ...state.settings, ...patch })));
  }
  const save = (patch: Partial<Settings>) => perform(() => updateSettings(patch));
  async function refreshMicrophones() {
    await perform(async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setMicrophones((await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'audioinput'));
    });
  }
  function navigate(next: typeof tab) { setTab(next); setError(''); setNotice(''); setKey(''); }
  const ready = Boolean(state?.hasKey && !state.shortcutError && !state.storageWarning && !state.startupError && !state.microphoneIssue);
  return <div className="app-shell">
    <header className="titlebar">
      <div className="brand"><Logo /><div><span className="brand-name">Cawal</span><span className="brand-tagline">Cangkem Virtual</span></div></div>
      {state?.setupFromInstaller && <span className="setup-titlebar-label">/ Setup</span>}
      <div className="window-buttons"><button aria-label="Minimize Cawal" onClick={() => void api.window('minimize')}><MinusIcon /></button><button aria-label="Close to tray" onClick={() => void api.window('hide')}><Cross2Icon /></button></div>
    </header>
    {state && state.onboarding !== 'complete' ? <Onboarding state={state} /> : <div className="workspace">
      <div className="navigation-row"><nav className="navigation" aria-label="Cawal settings"><div className="tabs">
        <button className={tab === 'general' ? 'selected' : ''} aria-current={tab === 'general' ? 'page' : undefined} onClick={() => navigate('general')}><GearIcon />General</button>
        <button className={tab === 'connection' ? 'selected' : ''} aria-current={tab === 'connection' ? 'page' : undefined} onClick={() => navigate('connection')}><Link2Icon />Connection</button>
      </div></nav>
      <span className={`background-status ${ready ? 'ready' : ''}`} role="status"><span />{busy && state ? labels[state.phase] : ready ? 'Ready' : 'Setup needed'}</span></div>
      <main className="app-body settings-view">
        <h1>{tab === 'general' ? 'Settings' : 'Connection'}</h1>
        <p className="page-description">{tab === 'general' ? 'Pake Cangkem Virtual , Build Aplikasi 2.5x Lebih Cepat' : 'One connection for voice and writing.'}</p>
        {!state ? <p className="loading" role="status">Getting Cawal ready…</p> : <>
          {(error || state.error) && <div className="message" role="alert"><ExclamationTriangleIcon /><span>{error || state.error}</span>{state.canRetry && <button className="text-button" disabled={disabled} onClick={() => void perform(() => unwrap(api.action('retry')))}>Try again</button>}</div>}
          {state.microphoneIssue && <div className="message microphone-recovery" role="status"><InfoCircledIcon /><span>Recording stopped. Choose another microphone in General or switch to the Windows default.</span><button className="text-button use-default-mic" disabled={disabled} onClick={() => void perform(async () => { await updateSettings({ microphone: '' }); await unwrap(api.action('clear')); }, 'Default microphone selected. Press your shortcut to record again.')}>Use default microphone</button></div>}
          {notice && <div className="message" role="status"><CheckIcon /><span>{notice}</span></div>}
          {state.shortcutError && <div className="message" role="alert"><ExclamationTriangleIcon /><span>{state.shortcutError}</span></div>}
          {state.storageWarning && <div className="message" role="alert"><ExclamationTriangleIcon /><span>{state.storageWarning}</span></div>}
          {state.startupError && <div className="message" role="alert"><ExclamationTriangleIcon /><span>{state.startupError}</span></div>}
          {state.warning && <div className="message" role="status"><InfoCircledIcon /><span>{state.warning}</span></div>}
          {state.result && !state.result.pasted && <div className="message recovery" role="status"><InfoCircledIcon /><span>{state.result.message}</span><button className="text-button" disabled={working} onClick={() => void perform(() => unwrap(api.copy()), 'Text copied. Paste with Ctrl+V.')}>Copy again</button><button className="icon-button" disabled={busy} aria-label="Dismiss notification" onClick={() => void api.action('clear')}><Cross2Icon /></button></div>}
          {tab === 'general' ? <>
            {!state.hasKey && <div className="message" role="status"><InfoCircledIcon /><span>Add a Groq API key to enable dictation.</span><button className="text-button" onClick={() => navigate('connection')}>Set up connection</button></div>}
            <section className="shortcut-setting" aria-labelledby="shortcut-title"><h2 id="shortcut-title">Dictation shortcut</h2><ShortcutEditor value={state.settings.hotkey} capturing={state.shortcutCapturing} disabled={disabled} onSave={async hotkey => { workingRef.current = true; setWorking(true); try { await updateSettings({ hotkey }); } finally { workingRef.current = false; setWorking(false); } }} /></section>
            <div className="settings-columns"><section className="settings-group" aria-label="Voice">
              <h2 className="section-title"><SectionIcon kind="voice" />Voice</h2>
              <div className="setting-row"><label htmlFor="microphone">Microphone</label><div className="select-with-button"><select id="microphone" value={state.settings.microphone} disabled={disabled} onChange={event => void save({ microphone: event.target.value })}><option value="">Default microphone</option>{microphones.filter(mic => mic.deviceId && mic.deviceId !== 'default' && mic.deviceId !== 'communications').map((mic,index) => <option key={mic.deviceId} value={mic.deviceId}>{mic.label || `Microphone ${index + 1}`}</option>)}{state.settings.microphone && !microphones.some(mic => mic.deviceId === state.settings.microphone) && <option value={state.settings.microphone}>Microphone unavailable</option>}</select><button className="icon-button refresh-mic" aria-label="Refresh microphones" disabled={disabled} onClick={() => void refreshMicrophones()}><ReloadIcon /></button></div></div>
              <div className="setting-row"><label htmlFor="model">Speech model</label><select id="model" value={state.settings.model} disabled={disabled} onChange={event => void save({ model: event.target.value as Settings['model'] })}><option value="whisper-large-v3-turbo">Whisper V3 Turbo</option><option value="whisper-large-v3">Whisper V3</option></select></div>
            </section>
            <section className="settings-group preferences" aria-label="Preferences">
              <h2 className="section-title"><SectionIcon kind="writing" />Language &amp; writing</h2>
              <div className="setting-row"><span>Language</span><span className="field-help">Indonesia</span></div>
              <div className="setting-row polish-row"><div><span>Polish with AI</span><p className="field-help">Clean punctuation and paragraphs.</p></div><div className="inline-setting"><Switch label="Polish with AI" checked={state.settings.cleanup} disabled={disabled} onChange={value => void save({ cleanup: value })} /><span className="model-badge">Qwen 3.8</span></div></div>
            </section></div>
            <section className="startup-setting"><div className="startup-copy"><SectionIcon kind="windows" /><div><h2>Start with Windows</h2><p>Ready whenever you need it.</p></div></div><Switch label="Start with Windows" checked={state.startupRegistered ?? state.settings.autoStart} disabled={disabled} onChange={value => void save({ autoStart: value })} /></section>
          </> : <section className="connection-view" aria-label="Groq connection">
            <div className="connection-intro"><div className="connection-symbol"><Link2Icon /></div><div><h2>Groq</h2><p>One API key for transcription and AI polishing.</p></div><span className="key-status">{state.hasKey ? <><CheckIcon />Saved</> : 'Not configured'}</span></div>
            <label className="input-label" htmlFor="groq-key">API key</label>
            <div className="key-input-row"><div className="key-input"><KeyField value={key} onChange={setKey} saved={state.hasKey} disabled={disabled} /></div><button className="primary save-key" disabled={!key.trim() || disabled} onClick={() => void perform(async () => { await unwrap(api.saveKey(key)); setKey(''); }, 'API key saved securely.')}>Save</button></div>
            <p className="field-help">Your key is encrypted and stored on this device.</p>
            <button className="text-button get-groq-key" disabled={disabled} onClick={() => void perform(() => unwrap(api.openGroqKeys()))}>Get a Groq API key</button>
            <div className="connection-actions"><button className="secondary test-connection" disabled={(!key && !state.hasKey) || disabled} onClick={() => void perform(async () => { setNotice(await unwrap(api.testKey(key))); })}>{working ? 'Checking…' : 'Test connection'}</button>{state.hasKey && <button className="text-button remove-key" disabled={disabled} onClick={() => void perform(async () => { await unwrap(api.removeKey()); }, 'API key removed.')}>Remove key</button>}</div>
            <div className="connection-details"><div><span>Transcription</span><span>{state.settings.model === 'whisper-large-v3-turbo' ? 'Whisper V3 Turbo' : 'Whisper V3'}</span></div><div><span>AI polishing</span><span>{state.settings.cleanup ? 'Qwen 3.8' : 'Off'}</span></div></div>
            <p className="privacy-note"><InfoCircledIcon />Audio and text are processed by Groq.</p>
          </section>}
        </>}
      </main>
      <footer><span className={`provider-label ${state?.hasKey ? 'configured' : ''}`}><span />{state?.hasKey ? 'Connected to Groq' : 'Groq · Not connected'}</span><span className="footer-hint">Close this window. Your shortcut stays active.</span></footer>
    </div>}
  </div>;
}
