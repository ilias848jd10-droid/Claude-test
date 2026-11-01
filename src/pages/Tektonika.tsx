import { useEffect, useState } from "react";
import bundledReport from "../../reports/eleftheros-christon-ithon.md?raw";
import { renderInline, renderMarkdown, splitSections } from "../lib/miniMarkdown";

// The weekly job pushes new reports to main; read the live file from
// GitHub so a new report shows up right away, and fall back to the copy
// bundled at build time when offline or if GitHub is unreachable.
const LIVE_URL =
  "https://raw.githubusercontent.com/ilias848jd10-droid/Claude-test/main/reports/eleftheros-christon-ithon.md";
const SOURCE_URL =
  "https://github.com/ilias848jd10-droid/Claude-test/blob/main/reports/eleftheros-christon-ithon.md";

export default function Tektonika() {
  const [md, setMd] = useState<string>(bundledReport);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(LIVE_URL, { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((text) => {
        if (!cancelled && text.trim()) {
          setMd(text);
          setLive(true);
        }
      })
      .catch(() => {
        /* keep bundled copy */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { intro, sections } = splitSections(md);
  const titleMatch = /^#\s+(.*)$/m.exec(intro);
  const introBody = intro.replace(/^#\s+.*$/m, "").replace(/^-{3,}\s*$/gm, "");
  const newestFirst = [...sections].reverse();

  return (
    <div className="dashboard tektonika-page">
      <header className="page-header">
        <h1>{titleMatch ? renderInline(titleMatch[1], "t") : "Τεκτονικές αναφορές"}</h1>
        <p className="last-updated">
          {sections.length} {sections.length === 1 ? "αναφορά" : "αναφορές"} · νέα αναφορά κάθε
          Δευτέρα στις 09:45 · {live ? "ζωντανή έκδοση από το GitHub" : "αποθηκευμένη έκδοση"} ·{" "}
          <a className="md-link" href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
            αρχείο στο GitHub
          </a>
        </p>
      </header>

      {newestFirst.map((s, i) => (
        <details key={s.title} className="report-card" open={i === 0}>
          <summary>
            {renderInline(s.title, `s${i}`)}
            {i === 0 && <span className="report-badge">Νεότερη</span>}
          </summary>
          <div className="md-body">{renderMarkdown(s.body)}</div>
        </details>
      ))}

      <details className="report-card report-about">
        <summary>Σχετικά με την αναζήτηση</summary>
        <div className="md-body">{renderMarkdown(introBody)}</div>
      </details>
    </div>
  );
}
