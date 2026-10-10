import type { ReactNode } from 'react';

function Inline({ text }: { text: string }) {
  const parts = text.split(
    /(\*\*[^*]+?\*\*|\*[^*]+?\*|`[^`]+?`|~[^~]+?~)/g,
  );
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**') && p.length >= 4) {
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith('*') && p.endsWith('*') && p.length >= 2) {
      return <em key={i}>{p.slice(1, -1)}</em>;
    }
    if (p.startsWith('`') && p.endsWith('`') && p.length >= 2) {
      return (
        <code
          key={i}
          className="rounded-sm bg-zinc-900/8 px-0.5 font-mono text-[0.92em]">
          {p.slice(1, -1)}
        </code>
      );
    }
    if (p.startsWith('~') && p.endsWith('~') && p.length >= 2) {
      return <s key={i}>{p.slice(1, -1)}</s>;
    }
    return <span key={i}>{p}</span>;
  });
}

function MdLine({ line }: { line: string }) {
  const heading = line.match(/^(#{1,4})\s+(.*)$/);
  if (heading) {
    const n = heading[1].length;
    const size =
      n === 1
        ? 'text-xl font-semibold'
        : n === 2
          ? 'text-lg font-semibold'
          : n === 3
            ? 'text-base font-semibold'
            : 'text-sm font-semibold';
    return (
      <div className={size}>
        <Inline text={heading[2]} />
      </div>
    );
  }
  const quote = line.match(/^>\s?(.*)$/);
  if (quote) {
    return (
      <div className="border-l-2 border-zinc-300 pl-2 text-zinc-600">
        <Inline text={quote[1]} />
      </div>
    );
  }
  const list = line.match(/^(\t*)([-*]|\d+\.)\s+(.*)$/);
  if (list) {
    const bullet = list[2] === '-' || list[2] === '*' ? '•' : list[2];
    return (
      <div
        className="flex gap-1.5"
        style={{ paddingLeft: list[1].length * 16 }}>
        <span className="w-4 shrink-0 text-zinc-500">{bullet}</span>
        <span className="min-w-0">
          <Inline text={list[3]} />
        </span>
      </div>
    );
  }
  if (!line) return <div className="h-2" />;
  return (
    <div>
      <Inline text={line} />
    </div>
  );
}

export function Markdown({ text }: { text: string }): ReactNode {
  if (!text) return null;
  return (
    <div className="flex flex-col gap-0.5">
      {text.split('\n').map((line, i) => (
        <MdLine
          key={i}
          line={line}
        />
      ))}
    </div>
  );
}
