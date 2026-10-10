'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isTextUIPart, type UIMessage } from 'ai';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import type { AskTurn, Item } from '@/lib/types';
import { boxesForAsk, connectorEdges } from '@/lib/connectors';
import { nowISO } from '@/lib/store';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller';

const PASS_KEY = 'margin:passcode';

type AskMeta = {
  scope?: number;
  at?: string;
  status?: AskTurn['status'];
};

type AskMessage = UIMessage<AskMeta>;

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

function textOf(m: AskMessage): string {
  return m.parts
    .filter(isTextUIPart)
    .map((p) => p.text)
    .join('');
}

function turnsToMessages(turns: AskTurn[]): AskMessage[] {
  const out: AskMessage[] = [];
  for (const t of turns) {
    out.push({
      id: t.id,
      role: 'user',
      metadata: { scope: t.scope, at: t.at },
      parts: [{ type: 'text', text: t.q }],
    });
    if (t.a || t.status !== 'done') {
      out.push({
        id: `${t.id}-a`,
        role: 'assistant',
        metadata: { status: t.status },
        parts: [{ type: 'text', text: t.a }],
      });
    }
  }
  return out;
}

function dropLastTurn(messages: AskMessage[]): AskMessage[] {
  const next = [...messages];
  if (next.at(-1)?.role === 'assistant') next.pop();
  if (next.at(-1)?.role === 'user') next.pop();
  return next;
}

function messagesToTurns(
  messages: AskMessage[],
  lastStatus: AskTurn['status'],
  fallbackScope: number,
): AskTurn[] {
  const turns: AskTurn[] = [];
  let pending: AskMessage | undefined;
  for (const m of messages) {
    if (m.role === 'user') {
      if (pending) {
        turns.push({
          id: pending.id,
          q: textOf(pending),
          a: '',
          at:
            typeof pending.metadata?.at === 'string'
              ? pending.metadata.at
              : nowISO(),
          scope:
            typeof pending.metadata?.scope === 'number'
              ? pending.metadata.scope
              : fallbackScope,
          status: 'done',
        });
      }
      pending = m;
    } else if (m.role === 'assistant' && pending) {
      turns.push({
        id: pending.id,
        q: textOf(pending),
        a: textOf(m),
        at:
          typeof pending.metadata?.at === 'string'
            ? pending.metadata.at
            : nowISO(),
        scope:
          typeof pending.metadata?.scope === 'number'
            ? pending.metadata.scope
            : fallbackScope,
        status: m.metadata?.status ?? 'done',
      });
      pending = undefined;
    }
  }
  if (pending) {
    turns.push({
      id: pending.id,
      q: textOf(pending),
      a: '',
      at:
        typeof pending.metadata?.at === 'string'
          ? pending.metadata.at
          : nowISO(),
      scope:
        typeof pending.metadata?.scope === 'number'
          ? pending.metadata.scope
          : fallbackScope,
      status: lastStatus,
    });
  } else if (turns.length) {
    turns[turns.length - 1] = {
      ...turns[turns.length - 1],
      status: lastStatus,
    };
  }
  return turns.slice(-30);
}

function lastUserTextFromBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as AskMessage | undefined;
    if (m?.role === 'user') return textOf(m) || null;
  }
  return null;
}

export default function AskPanel(props: Props) {
  const [input, setInput] = useState('');
  const [needPass, setNeedPass] = useState(false);
  const [needSignIn, setNeedSignIn] = useState(false);
  const [pass, setPass] = useState('');
  const [pendingQ, setPendingQ] = useState<string | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const authBlock = useRef<'signin' | 'passcode' | null>(null);
  const boardRef = useRef({
    boardName: props.boardName,
    items: props.items,
    selectedIds: props.selectedIds,
  });
  boardRef.current = {
    boardName: props.boardName,
    items: props.items,
    selectedIds: props.selectedIds,
  };

  const transport = useMemo(
    () =>
      new DefaultChatTransport<AskMessage>({
        api: '/api/ask',
        headers: () => ({ 'x-margin-passcode': readPass() }),
        body: () => {
          const b = boardRef.current;
          const boxes = boxesForAsk(b.items);
          const boxIds = new Set(boxes.map((i) => i.id));
          return {
            boardName: b.boardName,
            items: boxes.map((i) => ({
              id: i.id,
              text: i.text,
              x: i.x,
              y: i.y,
              by: i.by,
            })),
            edges: connectorEdges(b.items),
            selectedIds: b.selectedIds.filter((id) => boxIds.has(id)),
          };
        },
        fetch: async (input, init) => {
          const res = await fetch(input, init);
          if (res.status !== 401) return res;
          let code: 'signin' | 'passcode' = 'passcode';
          let msg = '';
          try {
            const j = (await res.json()) as { error?: string; code?: string };
            if (j.code === 'signin') code = 'signin';
            if (j.error) msg = j.error;
          } catch {
            // no body
          }
          authBlock.current = code;
          if (code === 'signin') {
            setNeedSignIn(true);
          } else {
            setNeedPass(true);
            try {
              setPendingQ(
                lastUserTextFromBody(JSON.parse(String(init?.body ?? ''))),
              );
            } catch {
              setPendingQ(null);
            }
          }
          return new Response(JSON.stringify({ error: msg, code }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          });
        },
      }),
    [],
  );

  const { messages, sendMessage, setMessages, stop, status } =
    useChat<AskMessage>({
      transport,
      messages: turnsToMessages(props.turns),
      onFinish({ messages: next, isAbort, isError }) {
        const p = propsRef.current;
        const fallbackScope = p.selectedIds.length || p.items.length;
        if (authBlock.current === 'passcode') {
          const kept = dropLastTurn(next);
          setMessages(kept);
          p.onTurns(messagesToTurns(kept, 'done', fallbackScope));
          authBlock.current = null;
          return;
        }
        let lastStatus: AskTurn['status'] = isAbort
          ? 'stopped'
          : isError
            ? 'error'
            : 'done';
        let msgs = next;
        const last = msgs.at(-1);
        if (last?.role === 'assistant') {
          let a = textOf(last);
          if (!a.trim() && lastStatus === 'done') lastStatus = 'error';
          if (!a.trim() && lastStatus === 'error') {
            a =
              authBlock.current === 'signin'
                ? 'Sign in again to keep asking.'
                : 'No answer came back. Try asking again.';
          }
          msgs = msgs.map((m, i) =>
            i === msgs.length - 1
              ? {
                  ...m,
                  metadata: { ...m.metadata, status: lastStatus },
                  parts: [{ type: 'text', text: a }],
                }
              : m,
          );
          setMessages(msgs);
        } else if (last?.role === 'user' && isError) {
          const a =
            authBlock.current === 'signin'
              ? 'Sign in again to keep asking.'
              : 'Something went wrong asking Claude.';
          msgs = [
            ...msgs,
            {
              id: `${last.id}-a`,
              role: 'assistant',
              metadata: { status: 'error' },
              parts: [{ type: 'text', text: a }],
            },
          ];
          lastStatus = 'error';
          setMessages(msgs);
        }
        p.onTurns(messagesToTurns(msgs, lastStatus, fallbackScope));
        authBlock.current = null;
      },
    });

  const stopRef = useRef(stop);
  stopRef.current = stop;

  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      void stopRef.current();
    };
  }, []);

  const busy = status === 'submitted' || status === 'streaming';
  const boxes = boxesForAsk(props.items);
  const selectedBoxes = props.selectedIds.filter((id) =>
    boxes.some((i) => i.id === id),
  );
  const scope = selectedBoxes.length || boxes.length;
  const scopeLabel = selectedBoxes.length
    ? `Reading ${selectedBoxes.length} selected box${selectedBoxes.length === 1 ? '' : 'es'}`
    : `Reading the whole board · ${boxes.length} box${boxes.length === 1 ? '' : 'es'}`;

  async function send(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setInput('');
    await sendMessage({ text: question, metadata: { scope, at: nowISO() } });
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

  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard unavailable
    }
  }

  function onHeaderDown(e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button')) return;
    if (window.matchMedia('(max-width: 640px)').matches) return;
    const panel = e.currentTarget.parentElement;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const ox = e.clientX - r.left;
    const oy = e.clientY - r.top;
    const move = (ev: PointerEvent) => {
      const x = Math.min(
        window.innerWidth - 120,
        Math.max(8 - r.width + 120, ev.clientX - ox),
      );
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

  const last = messages.at(-1);
  const waiting = busy && last?.role === 'user';

  return (
    <section
      className="fixed bottom-[calc(56px+env(safe-area-inset-top,0px))] right-3 z-30 grid w-100 max-h-[min(680px,calc(100vh-110px))] max-w-[calc(100vw-32px)] grid-rows-[auto_minmax(0,1fr)_auto] rounded-xl border border-stone-100 bg-white shadow-sm max-sm:!top-auto max-sm:!right-2 max-sm:!bottom-[calc(72px+env(safe-area-inset-bottom,0px))] max-sm:!left-2 max-sm:w-auto max-sm:max-h-[62vh] max-sm:max-w-none"
      aria-label="Ask"
      style={pos ? { left: pos.x, top: pos.y, right: 'auto' } : undefined}>
      <div
        className="flex cursor-grab items-center justify-between gap-2 border-b border-stone-100 pt-[11px] pr-3 pb-2.5 pl-3.5 touch-none max-sm:cursor-default"
        onPointerDown={onHeaderDown}>
        <div className="flex items-center gap-1.5">
          {messages.length > 0 && !busy && (
            <button
              type="button"
              className="cursor-pointer whitespace-nowrap rounded-md border border-stone-100 bg-transparent px-2.5 py-1 text-[13px] hover:border-zinc-400 disabled:cursor-default disabled:opacity-40"
              onClick={() => {
                setMessages([]);
                props.onTurns([]);
              }}>
              Clear
            </button>
          )}
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent px-1 text-xl leading-none text-zinc-400 hover:text-zinc-900"
            aria-label="Close"
            onClick={props.onClose}>
            {'×'}
          </button>
        </div>
      </div>

      <MessageScrollerProvider autoScroll>
        <MessageScroller className="min-h-20">
          <MessageScrollerViewport>
            <MessageScrollerContent className="gap-4 px-3.5 py-3">
              {messages.map((m, i) => {
                const isLast = i === messages.length - 1 && !waiting;
                const a = textOf(m);
                const streaming = busy && isLast && m.role === 'assistant';
                const isErr =
                  !streaming &&
                  (m.metadata?.status === 'error' ||
                    (status === 'error' && isLast && m.role === 'assistant'));
                const done =
                  !streaming &&
                  !busy &&
                  m.role === 'assistant' &&
                  m.metadata?.status !== 'error' &&
                  m.metadata?.status !== 'stopped' &&
                  !!a;
                return (
                  <MessageScrollerItem
                    key={m.id}
                    messageId={m.id}
                    scrollAnchor={isLast}>
                    {m.role === 'user' ? (
                      <div className="text-[13.5px] font-semibold wrap-anywhere whitespace-pre-wrap">
                        {a}
                      </div>
                    ) : streaming && !a ? (
                      <div className="border-l-[1.5px] border-sky-300 pl-[11px]  text-[15.5px] leading-relaxed text-zinc-400 italic">
                        Reading the board&hellip;
                      </div>
                    ) : (
                      <div className="grid gap-1.5">
                        <div
                          className={
                            'border-l-[1.5px] pl-[11px]  text-[15.5px] leading-relaxed wrap-anywhere whitespace-pre-wrap' +
                            (isErr
                              ? ' border-red-700 text-red-700'
                              : ' border-sky-300')
                          }>
                          {a}
                          {m.metadata?.status === 'stopped' && !streaming && (
                            <span className="text-zinc-400"> (stopped)</span>
                          )}
                        </div>
                        {done && (
                          <div className="flex gap-1.5 pl-3">
                            <button
                              type="button"
                              className="cursor-pointer whitespace-nowrap rounded-md border border-stone-100 bg-transparent px-2.5 py-1 text-[13px] hover:border-zinc-400 disabled:cursor-default disabled:opacity-40"
                              onClick={() => props.onPut(a)}>
                              Put on canvas
                            </button>
                            <button
                              type="button"
                              className="cursor-pointer whitespace-nowrap rounded-md border border-stone-100 bg-transparent px-2.5 py-1 text-[13px] hover:border-zinc-400 disabled:cursor-default disabled:opacity-40"
                              onClick={() => void copy(a, m.id)}>
                              {copied === m.id ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </MessageScrollerItem>
                );
              })}
              {waiting && (
                <MessageScrollerItem scrollAnchor>
                  <div className="border-l-[1.5px] border-sky-300 pl-[11px]  text-[15.5px] leading-relaxed text-zinc-400 italic">
                    Reading the board&hellip;
                  </div>
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      {needSignIn ? (
        <div className="grid gap-2 border-t border-stone-100 px-3 pt-2.5 pb-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] text-zinc-500">
              Your session ended.
            </span>
            <a
              className="inline-block cursor-pointer whitespace-nowrap rounded-md border border-zinc-900 bg-zinc-900 px-2.5 py-1 text-[13px] font-semibold text-stone-100 no-underline disabled:cursor-default disabled:opacity-40"
              href="/auth/sign-in">
              Sign in
            </a>
          </div>
        </div>
      ) : needPass ? (
        <form
          className="grid gap-2 border-t border-stone-100 px-3 pt-2.5 pb-3"
          onSubmit={savePass}>
          <label
            className="text-[13px] text-zinc-500"
            htmlFor="ask-pass">
            This deployment needs its passcode. It&rsquo;s saved in this
            browser.
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
              className="w-full min-w-0 rounded-lg border border-stone-100 bg-stone-100 px-2.5 py-1.5 focus:outline-2 focus:-outline-offset-1 focus:outline-sky-700"
            />
            <button
              type="submit"
              className="inline-block cursor-pointer whitespace-nowrap rounded-md border border-zinc-900 bg-zinc-900 px-2.5 py-1 text-[13px] font-semibold text-stone-100 no-underline disabled:cursor-default disabled:opacity-40"
              disabled={!pass.trim()}>
              Save
            </button>
          </div>
        </form>
      ) : (
        <form
          className="grid gap-2 border-t border-stone-100 px-3 pt-2.5 pb-3"
          onSubmit={onSubmit}>
          <textarea
            id="ask-input"
            ref={inputRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Find, check, or talk something through"
            className="w-full min-w-0 resize-none rounded-lg border border-stone-100 bg-stone-100 px-2.5 py-1.5 text-sm leading-snug focus:outline-2 focus:-outline-offset-1 focus:outline-sky-700"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] text-zinc-400">
              Enter to ask &middot; Shift+Enter for a new line
            </span>
            {busy ? (
              <button
                type="button"
                className="cursor-pointer whitespace-nowrap rounded-md border border-stone-100 bg-transparent px-2.5 py-1 text-[13px] hover:border-zinc-400 disabled:cursor-default disabled:opacity-40"
                onClick={() => stop()}>
                Stop
              </button>
            ) : (
              <button
                type="submit"
                className="inline-block cursor-pointer whitespace-nowrap rounded-md border border-zinc-900 bg-zinc-900 px-2.5 py-1 text-[13px] font-semibold text-stone-100 no-underline disabled:cursor-default disabled:opacity-40"
                disabled={!input.trim()}>
                Ask
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
