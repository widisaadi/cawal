import { useEffect, useState } from 'react';
import FlowLine from './FlowLine';
import cawalIcon from '../resources/icon.png';
import { busyPhases, labels, type Snapshot } from './types';

function shortIssue(message: string, polishing: boolean) {
  if (polishing) return 'Polishing gagal. Teks asli dipakai.';
  const text = message.toLowerCase();
  const reason = /limit/.test(text) ? 'Limit Groq tercapai'
    : /api key/.test(text) ? 'API key tidak valid'
    : /terlalu lama|timed out|timeout/.test(text) ? 'Koneksi terlalu lama'
    : /dns|belum dapat ditemukan/.test(text) ? 'Koneksi belum tersedia'
    : /koneksi aman/.test(text) ? 'Koneksi aman bermasalah'
    : /koneksi|internet/.test(text) ? 'Koneksi terputus'
    : /gangguan|sedang penuh/.test(text) ? 'Groq sedang bermasalah'
    : /izin|akses/.test(text) ? 'Akses Groq ditolak'
    : /model.*tidak tersedia/.test(text) ? 'Model belum tersedia'
    : polishing ? 'Teks asli tetap dipakai' : 'Dikte gagal. Coba lagi';
  return polishing ? `Polishing: ${reason}` : reason;
}
// Compact island: icon of the app receiving the text, live wave, elapsed time.
export default function RecordingPill({ state }: { state: Snapshot }) {
  const recording = state.phase === 'recording';
  const [started, setStarted] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!recording) return;
    const start = Date.now(); setStarted(start); setNow(start);
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [recording]);
  const seconds = Math.max(0, Math.floor((now - started) / 1000));
  const issue = state.phase === 'error' ? state.error : state.phase === 'done' ? state.warning : '';
  if (issue) return <div className="overlay-notice" role="status">
    <img src={cawalIcon} alt="" />
    <span>{shortIssue(issue, state.phase === 'done')}</span>
  </div>;
  return <div className={`overlay-body ${recording ? 'is-recording' : 'is-processing'}`} role="img" aria-label={labels[state.phase]}>
    <img className="target-icon" src={state.targetIcon || cawalIcon} alt="" />
    <FlowLine active={recording} processing={!recording && busyPhases.includes(state.phase)} />
    <span className="elapsed">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span>
  </div>;
}
