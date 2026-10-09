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
  const [needSignIn, setNeedSignIn] = useState(false);
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
        let code = 'passcode';
        let msg = '';
        try {
          const j = (await res.json()) as { error?: string; code?: string };
          if (j.code) code = j.code;
          if (j.error) msg = j.error;
        } catch {
          // no body
        }
        if (code === 'signin') {
          setNeedSignIn(true);
          answer = msg || 'Sign in again to keep asking.';
          status = 'error';
        } else {
          setNeedPass(true);
          setPendingQ(question);
          props.onTurns(turnsRef.current.filter((t) => t.id !== turn.id));
          return;
        }
      } else if (!res.ok || !res.body) {
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
      className="fixed top-4 right-4 z-30 grid w-[400px] max-h-[min(680px,calc(100vh-110px))] max-w-[calc(100vw-32px)] grid-rows-[auto_minmax(0,1fr)_auto] rounded-xl border border-stone-300 bg-white shadow-xl max-sm:!top-auto max-sm:!right-2 max-sm:!bottom-[calc(72px+env(safe-area-inset-bottom,0px))] max-sm:!left-2 max-sm:w-auto max-sm:max-h-[62vh] max-sm:max-w-none"
      aria-label="Ask"
      style={pos ? { left: pos.x, top: pos.y, right: 'auto' } : undefined}
    >
      <div
        className="flex cursor-grab items-center justify-between gap-2 border-b border-stone-300 pt-[11px] pr-3 pb-2.5 pl-3.5 touch-none max-sm:cursor-default"
        onPointerDown={onHeaderDown}
      >
        <div className="grid min-w-0 gap-1">
          <span className="font-mono text-[11px] font-medium tracking-widest text-sky-700 uppercase">Ask</span>
          <span className="text-[13px] text-zinc-500">{scopeLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {turns.length > 0 && !busy && (
            <button type="button" className="cursor-pointer whitespace-nowrap rounded-md border border-stone-300 bg-transparent px-2.5 py-1 text-[13px] hover:border-zinc-400 disabled:cursor-default disabled:opacity-40" onClick={() => props.onTurns([])}>
              Clear
            </button>
          )}
          <button type="button" className="cursor-pointer border-0 bg-transparent px-1 text-xl leading-none text-zinc-400 hover:text-zinc-900" aria-label="Close" onClick={props.onClose}>
            {'×'}
          </button>
        </div>
      </div>

      <div className="grid min-h-20 content-start gap-[18px] overflow-auto px-3.5 py-3" ref={scroller}>
        {turns.length === 0 && (
          <p className="m-0 font-serif text-[15px] leading-snug font-normal text-zinc-500 italic">
            Ask about what&rsquo;s on this board. Select boxes first to narrow it. The assistant finds, reflects and asks
            questions back; it won&rsquo;t pitch ideas unless you ask for them.
          </p>
        )}
        {turns.map((t) => {
          const streaming = live && live.id === t.id;
          const a = streaming ? live.a : t.a;
          const isErr = t.status === 'error' && !streaming;
          return (
            <div className="grid gap-1.5" key={t.id}>
              <div className="text-[13.5px] font-semibold wrap-anywhere whitespace-pre-wrap">{t.q}</div>
              {streaming && !a ? (
                <div className="border-l-[1.5px] border-sky-300 pl-[11px] font-serif text-[15.5px] leading-relaxed text-zinc-400 italic">
                  Reading the board&hellip;
                </div>
              ) : (
                <div
                  className={
                    'border-l-[1.5px] pl-[11px] font-serif text-[15.5px] leading-relaxed wrap-anywhere whitespace-pre-wrap' +
                    (isErr ? ' border-red-700 text-red-700' : ' border-sky-300')
                  }
                >
                  {a}
                  {t.status === 'stopped' && !streaming && <span className="text-zinc-400"> (stopped)</span>}
                </div>
              )}
              {!streaming && t.status === 'done' && t.a && (
                <div className="flex gap-1.5 pl-3">
                  <button type="button" className="cursor-pointer whitespace-nowrap rounded-md border border-stone-300 bg-transparent px-2.5 py-1 text-[13px] hover:border-zinc-400 disabled:cursor-default disabled:opacity-40" onClick={() => props.onPut(t.a)}>
                    Put on canvas
                  </button>
                  <button type="button" className="cursor-pointer whitespace-nowrap rounded-md border border-stone-300 bg-transparent px-2.5 py-1 text-[13px] hover:border-zinc-400 disabled:cursor-default disabled:opacity-40" onClick={() => void copy(t)}>
                    {copied === t.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {needSignIn ? (
        <div className="grid gap-2 border-t border-stone-300 px-3 pt-2.5 pb-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] text-zinc-500">Your session ended.</span>
            <a className="inline-block cursor-pointer whitespace-nowrap rounded-md border border-zinc-900 bg-zinc-900 px-2.5 py-1 text-[13px] font-semibold text-stone-100 no-underline disabled:cursor-default disabled:opacity-40" href="/auth/sign-in">
              Sign in
            </a>
          </div>
        </div>
      ) : needPass ? (
        <form className="grid gap-2 border-t border-stone-300 px-3 pt-2.5 pb-3" onSubmit={savePass}>
          <label className="text-[13px] text-zinc-500" htmlFor="ask-pass">
            This deployment needs its passcode. It&rsquo;s saved in this browser.
          </label>
          <div className="flex items-center justify-between gap-2">
            <input
              id="ask-pass"
              type="password"
              autoComplete="current-password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="Passcode"
              autoFocus
              className="w-full min-w-0 rounded-lg border border-stone-300 bg-stone-100 px-2.5 py-1.5 focus:outline-2 focus:-outline-offset-1 focus:outline-sky-700"
            />
            <button type="submit" className="inline-block cursor-pointer whitespace-nowrap rounded-md border border-zinc-900 bg-zinc-900 px-2.5 py-1 text-[13px] font-semibold text-stone-100 no-underline disabled:cursor-default disabled:opacity-40" disabled={!pass.trim()}>
              Save
            </button>
          </div>
        </form>
      ) : (
        <form className="grid gap-2 border-t border-stone-300 px-3 pt-2.5 pb-3" onSubmit={onSubmit}>
          <textarea
            id="ask-input"
            ref={inputRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Find, check, or talk something through"
            className="w-full min-w-0 resize-none rounded-lg border border-stone-300 bg-stone-100 px-2.5 py-1.5 text-sm leading-snug focus:outline-2 focus:-outline-offset-1 focus:outline-sky-700"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] text-zinc-400">Enter to ask &middot; Shift+Enter for a new line</span>
            {busy ? (
              <button type="button" className="cursor-pointer whitespace-nowrap rounded-md border border-stone-300 bg-transparent px-2.5 py-1 text-[13px] hover:border-zinc-400 disabled:cursor-default disabled:opacity-40" onClick={() => ctl.current?.abort()}>
                Stop
              </button>
            ) : (
              <button type="submit" className="inline-block cursor-pointer whitespace-nowrap rounded-md border border-zinc-900 bg-zinc-900 px-2.5 py-1 text-[13px] font-semibold text-stone-100 no-underline disabled:cursor-default disabled:opacity-40" disabled={!input.trim()}>
                Ask
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
