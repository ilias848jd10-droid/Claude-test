import type { ReactNode } from "react";

// Minimal, safe Markdown → React renderer for the reports file.
// Supports: #/##/### headings, "- " lists, "---", paragraphs,
// [text](url), **bold**, *italic*, `code`. Everything is rendered as
// React text nodes (no innerHTML), so content found on the web can't
// inject markup.

function safeHref(url: string): string | undefined {
  return /^https?:\/\//i.test(url) ? url : undefined;
}

export function renderInline(text: string, keyPrefix = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${k++}`;
    if (m[1] !== undefined) {
      const href = safeHref(m[2]);
      out.push(
        href ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="md-link">
            {renderInline(m[1], key)}
          </a>
        ) : (
          <span key={key}>{renderInline(m[1], key)}</span>
        ),
      );
    } else if (m[3] !== undefined) {
      out.push(<strong key={key}>{renderInline(m[3], key)}</strong>);
    } else if (m[4] !== undefined) {
      out.push(<em key={key}>{renderInline(m[4], key)}</em>);
    } else if (m[5] !== undefined) {
      out.push(<code key={key}>{m[5]}</code>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function renderMarkdown(md: string): ReactNode[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let n = 0;

  const flushPara = () => {
    if (para.length) {
      const key = `p${n++}`;
      blocks.push(<p key={key}>{renderInline(para.join(" "), key)}</p>);
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      const key = `l${n++}`;
      blocks.push(
        <ul key={key}>
          {list.map((item, i) => (
            <li key={i}>{renderInline(item, `${key}-${i}`)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    const item = /^\s*[-*]\s+(.*)$/.exec(line);
    if (heading) {
      flushPara();
      flushList();
      const key = `h${n++}`;
      const level = heading[1].length;
      const content = renderInline(heading[2], key);
      blocks.push(
        level <= 2 ? <h3 key={key}>{content}</h3> : <h4 key={key}>{content}</h4>,
      );
    } else if (/^-{3,}$/.test(line.trim())) {
      flushPara();
      flushList();
      blocks.push(<hr key={`r${n++}`} />);
    } else if (item) {
      flushPara();
      list.push(item[1]);
    } else if (line.trim() === "") {
      flushPara();
      flushList();
    } else if (list.length && /^\s{2,}/.test(raw)) {
      list[list.length - 1] += " " + line.trim();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return blocks;
}

export interface MdSection {
  title: string;
  body: string;
}

/** Splits the file into the intro (before the first "## ") and the "## " sections. */
export function splitSections(md: string): { intro: string; sections: MdSection[] } {
  const parts = md.replace(/\r\n/g, "\n").split(/^## /m);
  const intro = parts.shift() ?? "";
  const sections = parts.map((p) => {
    const nl = p.indexOf("\n");
    return {
      title: (nl === -1 ? p : p.slice(0, nl)).trim(),
      body: nl === -1 ? "" : p.slice(nl + 1),
    };
  });
  return { intro, sections };
}
