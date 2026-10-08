'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { AskRequest, AskTurn, Item } from '@/lib/types';
import { nowISO, uid } from '@/lib/store';

const PASS_KEY = 'margin:passcode';

interface Props {
  boardName: string;
  items: Item[];
  selectedIds: string[];
  turns: AskTurn[];
  onTurns(turns: AskTurn[]): void;
  onPut(text: string): void;
  onClose(): void;
}

function readPass(): string {
  try {
    return window.localStorage.getItem(PASS_KEY) ?? '';
  } catch {
    return '';
  }
}

export default function AskPanel(props: Props) {
  const [input, setInput] = useState('');
  const [live, setLive] = useState<{ id: string; a: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [needPass, setNeedPass] = useState(false);
  const [pass, setPass] = useState('');
  const [pendingQ, setPendingQ] = useState<string | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const ctl = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const turnsRef = useRef(props.turns);
  turnsRef.current = props.turns;

  useEffect(() => {
    inputRef.current?.focus();
    return () => ctl.current?.abort();
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [props.turns.length, live?.a]);

  const scope = props.selectedIds.length || props.items.length;
  const scopeLabel = props.selectedIds.length
    ? `Reading ${props.selectedIds.length} selected box${props.selectedIds.length === 1 ? '' : 'es'}`
    : `Reading the whole board · ${props.items.length} box${props.items.length === 1 ? '' : 'es'}`;

  async function send(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    const turn: AskTurn = { id: uid('a_'), q: question, a: '', at: nowISO(), scope, status: 'done' };
    const history = turnsRef.current.filter((t) => t.status === 'done' && t.a).slice(-6).map((t) => ({ q: t.q, a: t.a }));
    props.onTurns([...turnsRef.current, turn].slice(-30));
    setInput('');
    setBusy(true);
    setLive({ id: turn.id, a: '' });
    const controller = new AbortController();
    ctl.current = controller;

    const body: AskRequest = {
      question,
      boardName: props.boardName,
      items: props.items.map((i) => ({ id: i.id, text: i.text, x: i.x, y: i.y, by: i.by })),
      selectedIds: props.selectedIds,
      history,
    };

    let answer = '';
    let status: AskTurn['status'] = 'done';
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-margin-passcode': readPass() },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (res.status === 401) {
        setNeedPass(true);
        setPendingQ(question);
        props.onTurns(turnsRef.current.filter((t) => t.id !== turn.id));
        return;
      }
      if (!res.ok || !res.body) {
        let msg = 'Something went wrong asking Claude.';
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          // keep the default message
        }
        answer = msg;
        status = 'error';
      } else {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          answer += dec.decode(value, { stream: true });
          setLive({ id: turn.id, a: answer });
        }
        answer += dec.decode();
        if (!answer.trim()) {
          answer = 'No answer came back. Try asking again.';
          status = 'error';
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        status = 'stopped';
      } else {
        answer = answer || 'Couldn’t reach the server. Check your connection and try again.';
        status = 'error';
      }
    } finally {
      ctl.current = null;
      setBusy(false);
      setLive(null);
    }
    props.onTurns(turnsRef.current.map((t) => (t.id === turn.id ? { ...t, a: answer, status } : t)));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function onInputKey(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      props.onClose();
    }
  }

  function savePass(e: FormEvent) {
    e.preventDefault();
    try {
      window.localStorage.setItem(PASS_KEY, pass.trim());
    } catch {
      // ignore
    }
    setNeedPass(false);
    setPass('');
    const q = pendingQ;
    setPendingQ(null);
    if (q) void send(q);
  }

  async function copy(t: AskTurn) {
    try {
      await navigator.clipboard.writeText(t.a);
      setCopied(t.id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard unavailable
    }
  }

  // Drag the panel by its header. It floats; nothing is docked.
  function onHeaderDown(e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button')) return;
    if (window.matchMedia('(max-width: 640px)').matches) return;
    const panel = e.currentTarget.parentElement;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const ox = e.clientX - r.left;
    const oy = e.clientY - r.top;
    const move = (ev: PointerEvent) => {
      const x = Math.min(window.innerWidth - 120, Math.max(8 - r.width + 120, ev.clientX - ox));
      const y = Math.min(window.innerHeight - 60, Math.max(8, ev.clientY - oy));
      setPos({ x, y });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  const turns = props.turns;

  return (
    <section
      className="float ask"
      aria-label="Ask"
      style={pos ? { left: pos.x, top: pos.y, right: 'auto' } : undefined}
    >
      <div className="ask-head" onPointerDown={onHeaderDown}>
        <div className="ask-title">
          <span className="eyebrow">Ask</span>
          <span className="scope">{scopeLabel}</span>
        </div>
        <div className="ask-head-actions">
          {turns.length > 0 && !busy && (
            <button type="button" className="ghost-btn" onClick={() => props.onTurns([])}>
              Clear
            </button>
          )}
          <button type="button" className="icon-btn" aria-label="Close" onClick={props.onClose}>
            {'×'}
          </button>
        </div>
      </div>

      <div className="ask-thread" ref={scroller}>
        {turns.length === 0 && (
          <p className="ask-empty">
            Ask about what&rsquo;s on this board. Select boxes first to narrow it. The assistant finds, reflects and asks
            questions back; it won&rsquo;t pitch ideas unless you ask for them.
          </p>
        )}
        {turns.map((t) => {
          const streaming = live && live.id === t.id;
          const a = streaming ? live.a : t.a;
          return (
            <div className="turn" key={t.id}>
              <div className="q">{t.q}</div>
              {streaming && !a ? (
                <div className="a pending">Reading the board&hellip;</div>
              ) : (
                <div className={'a' + (t.status === 'error' && !streaming ? ' err' : '')}>
                  {a}
                  {t.status === 'stopped' && !streaming && <span className="muted"> (stopped)</span>}
                </div>
              )}
              {!streaming && t.status === 'done' && t.a && (
                <div className="turn-actions">
                  <button type="button" className="ghost-btn" onClick={() => props.onPut(t.a)}>
                    Put on canvas
                  </button>
                  <button type="button" className="ghost-btn" onClick={() => void copy(t)}>
                    {copied === t.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {needPass ? (
        <form className="ask-foot" onSubmit={savePass}>
          <label className="pass-label" htmlFor="ask-pass">
            This deployment needs its passcode. It&rsquo;s saved in this browser.
          </label>
          <div className="row">
            <input
              id="ask-pass"
              type="password"
              autoComplete="current-password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="Passcode"
              autoFocus
            />
            <button type="submit" className="primary-btn" disabled={!pass.trim()}>
              Save
            </button>
          </div>
        </form>
      ) : (
        <form className="ask-foot" onSubmit={onSubmit}>
          <textarea
            id="ask-input"
            ref={inputRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Find, check, or talk something through"
          />
          <div className="row">
            <span className="hint-small">Enter to ask &middot; Shift+Enter for a new line</span>
            {busy ? (
              <button type="button" className="ghost-btn" onClick={() => ctl.current?.abort()}>
                Stop
              </button>
            ) : (
              <button type="submit" className="primary-btn" disabled={!input.trim()}>
                Ask
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
