import React, { useMemo, useState } from 'react';
import {
  FileText,
  FolderOpen,
  Search,
  Copy,
  Check,
  Download,
  Code2,
  ChevronRight,
} from 'lucide-react';
import { motion } from 'motion/react';

import docIndex from '../../docs/README.md?raw';
import doc01 from '../../docs/01-architecture-auth-and-design-styles.md?raw';
import doc02 from '../../docs/02-firebase-costs-and-auth-alternatives.md?raw';
import doc03 from '../../docs/03-self-serve-oauth-guide-and-providers.md?raw';
import doc04 from '../../docs/04-automated-onboarding-workflows.md?raw';
import doc05 from '../../docs/05-site-pages-and-files-blueprint.md?raw';
import doc06 from '../../docs/06-asset-search-and-discovery.md?raw';
import doc07 from '../../docs/07-ai-studio-packaging-and-pricing.md?raw';
import doc08 from '../../docs/08-loan-broker-repositioning-assets-and-master-prompts.md?raw';
import doc09 from '../../docs/09-feature-backlog-and-component-specs.md?raw';
import integrationsYaml from '../../config/integrations.yaml?raw';

interface DocEntry {
  id: string;
  order: string;
  title: string;
  path: string;
  format: 'md' | 'yaml';
  summary: string;
  content: string;
}

const BLUEPRINT_DOCS: DocEntry[] = [
  {
    id: 'index',
    order: '00',
    title: 'Master Index',
    path: '/docs/README.md',
    format: 'md',
    summary: 'Ordered table of contents across all platform strategy & architecture docs.',
    content: docIndex,
  },
  {
    id: 'doc-01',
    order: '01',
    title: 'Auth Strategy, Tech Stack & Design Styles',
    path: '/docs/01-architecture-auth-and-design-styles.md',
    format: 'md',
    summary: 'Member login, universal landing page, OAuth screen, stack advice & 3 luxury design variations.',
    content: doc01,
  },
  {
    id: 'doc-02',
    order: '02',
    title: 'Firebase Costs & Auth Alternatives',
    path: '/docs/02-firebase-costs-and-auth-alternatives.md',
    format: 'md',
    summary: 'Firebase Auth + Firestore pricing, pass-through rules, Gemini key check & full alternatives list.',
    content: doc02,
  },
  {
    id: 'doc-03',
    order: '03',
    title: 'Self-Serve OAuth 2.0 Guide & Providers',
    path: '/docs/03-self-serve-oauth-guide-and-providers.md',
    format: 'md',
    summary: 'Manual OAuth setup, callback URLs, iframe rules & complete provider catalog.',
    content: doc03,
  },
  {
    id: 'doc-04',
    order: '04',
    title: 'Automated Onboarding Workflows',
    path: '/docs/04-automated-onboarding-workflows.md',
    format: 'md',
    summary: 'Cross-tool automations for your selected stack, complementary tools & 3-phase rollout.',
    content: doc04,
  },
  {
    id: 'doc-05',
    order: '05',
    title: 'Additional Pages & Supporting Files Blueprint',
    path: '/docs/05-site-pages-and-files-blueprint.md',
    format: 'md',
    summary: 'Public, portal, admin, legal pages & complete file list by extension (.ts, .md, .yaml, .html).',
    content: doc05,
  },
  {
    id: 'doc-06',
    order: '06',
    title: 'Searching & Surfacing Available Assets',
    path: '/docs/06-asset-search-and-discovery.md',
    format: 'md',
    summary: 'How to search & sync existing assets across Google Drive, Notion, Wix, Canva, and Vimeo.',
    content: doc06,
  },
  {
    id: 'doc-07',
    order: '07',
    title: 'AI Studio Packaging, Pricing & Economics',
    path: '/docs/07-ai-studio-packaging-and-pricing.md',
    format: 'md',
    summary: 'Credit matrix, 3-tier pricing, top-up packs, margin analysis & Stripe webhook checklist.',
    content: doc07,
  },
  {
    id: 'doc-08',
    order: '08',
    title: 'Loan Broker Copy, Visual Prompts, Master Prompts & Drive OAuth',
    path: '/docs/08-loan-broker-repositioning-assets-and-master-prompts.md',
    format: 'md',
    summary: 'Funding agency repositioning, stock & AI image prompts, multi-tool master prompts & Google Drive OAuth.',
    content: doc08,
  },
  {
    id: 'doc-09',
    order: '09',
    title: 'Feature Backlog & Component Specs',
    path: '/docs/09-feature-backlog-and-component-specs.md',
    format: 'md',
    summary: 'Tracking specs for Network Leaderboard, Notification Center, Start Module Video Modal & Phase 2 features.',
    content: doc09,
  },
  {
    id: 'config-yaml',
    order: '10',
    title: 'Integrations Config (YAML)',
    path: '/config/integrations.yaml',
    format: 'yaml',
    summary: 'Declarative YAML catalog of your chosen integrations across Phases 1–3.',
    content: integrationsYaml,
  },
];

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-white/10 text-gold text-[12px] font-mono break-all"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={idx} className="italic text-white/80">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function SafeMarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (trimmed === '---') {
      elements.push(<hr key={i} className="border-white/10 my-6" />);
      i++;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      elements.push(
        <div
          key={`code-${i}`}
          className="my-4 rounded-2xl border border-white/10 bg-black/50 overflow-hidden"
        >
          {lang && (
            <div className="px-4 py-1.5 border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-widest text-gold/80 font-mono">
              {lang}
            </div>
          )}
          <pre className="p-4 text-xs font-mono text-white/85 leading-relaxed whitespace-pre-wrap overflow-x-auto">
            {codeLines.join('\n')}
          </pre>
        </div>
      );
      continue;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      const rows = tableLines
        .filter((r) => !/^\|[\s:|-]+\|$/.test(r))
        .map((r) =>
          r
            .slice(1, -1)
            .split('|')
            .map((cell) => cell.trim())
        );
      if (rows.length > 0) {
        const [header, ...body] = rows;
        elements.push(
          <div key={`table-${i}`} className="overflow-x-auto my-5 rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-gold text-xs uppercase tracking-wider">
                <tr>
                  {header.map((cell, ci) => (
                    <th key={ci} className="px-4 py-3 font-semibold">
                      {renderInlineMarkdown(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {body.map((row, ri) => (
                  <tr key={ri} className="hover:bg-white/[0.03]">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-4 py-3 text-white/75">
                        {renderInlineMarkdown(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote
          key={i}
          className="border-l-2 border-gold pl-4 py-2 my-4 bg-gold/5 rounded-r-xl text-sm text-white/80"
        >
          {renderInlineMarkdown(trimmed.slice(2))}
        </blockquote>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('#### ')) {
      elements.push(
        <h4 key={i} className="text-base font-semibold text-gold mt-6 mb-2">
          {renderInlineMarkdown(trimmed.slice(5))}
        </h4>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="text-xl font-display text-white mt-7 mb-2.5">
          {renderInlineMarkdown(trimmed.slice(4))}
        </h3>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-2xl font-display text-gold mt-8 mb-3 pb-2 border-b border-white/10">
          {renderInlineMarkdown(trimmed.slice(3))}
        </h2>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={i} className="text-3xl md:text-4xl font-display text-white mb-4">
          {renderInlineMarkdown(trimmed.slice(2))}
        </h1>
      );
      i++;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const isOrdered = /^\d+\.\s+/.test(trimmed);
      const items: { indent: number; text: string }[] = [];
      while (
        i < lines.length &&
        (/^[-*]\s+/.test(lines[i].trim()) || /^\d+\.\s+/.test(lines[i].trim()))
      ) {
        const leadingSpaces = lines[i].match(/^(\s*)/)?.[1].length ?? 0;
        const text = lines[i].trim().replace(/^([-*]|\d+\.)\s+/, '');
        items.push({ indent: leadingSpaces, text });
        i++;
      }
      const ListTag = isOrdered ? 'ol' : 'ul';
      elements.push(
        <ListTag
          key={`list-${i}`}
          className={`my-3 space-y-2 text-sm text-white/75 leading-relaxed ${
            isOrdered ? 'list-decimal pl-5' : 'list-none pl-0'
          }`}
        >
          {items.map((item, idx) => (
            <li
              key={idx}
              className={
                isOrdered
                  ? 'pl-1'
                  : `flex items-start gap-2.5 ${item.indent >= 2 ? 'ml-5' : ''}`
              }
            >
              {!isOrdered && (
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" />
              )}
              <span>{renderInlineMarkdown(item.text)}</span>
            </li>
          ))}
        </ListTag>
      );
      continue;
    }

    elements.push(
      <p key={i} className="text-sm text-white/75 leading-relaxed my-3">
        {renderInlineMarkdown(trimmed)}
      </p>
    );
    i++;
  }

  return <div>{elements}</div>;
}

export default function BlueprintDocsPage() {
  const [selectedId, setSelectedId] = useState<string>('doc-01');
  const [query, setQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BLUEPRINT_DOCS;
    return BLUEPRINT_DOCS.filter(
      (doc) =>
        doc.title.toLowerCase().includes(q) ||
        doc.path.toLowerCase().includes(q) ||
        doc.summary.toLowerCase().includes(q) ||
        doc.content.toLowerCase().includes(q)
    );
  }, [query]);

  const activeDoc =
    BLUEPRINT_DOCS.find((d) => d.id === selectedId) ?? BLUEPRINT_DOCS[0];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeDoc.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable in restricted context
    }
  };

  const handleDownload = () => {
    const blob = new Blob([activeDoc.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeDoc.path.split('/').pop() ?? `${activeDoc.id}.${activeDoc.format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      key="docs"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.3em] text-gold font-bold mb-2 flex items-center gap-2">
            <FolderOpen size={14} /> /docs &amp; /config Repository Library
          </p>
          <h1 className="text-4xl md:text-5xl font-display mb-3">
            Platform <span className="text-gold italic">Blueprint Docs</span>
          </h1>
          <p className="text-base opacity-60 font-light">
            Ordered architecture, Firebase pricing, auth alternatives, self-serve OAuth 2.0, workflow automations, and site expansion specs—synced directly from your workspace files.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search
            size={15}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter docs or topics..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-full text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-gold/50"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Ordered Document Sidebar */}
        <aside className="lg:col-span-4 space-y-2.5">
          {filteredDocs.map((doc) => {
            const isSelected = doc.id === activeDoc.id;
            return (
              <button
                key={doc.id}
                onClick={() => setSelectedId(doc.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                  isSelected
                    ? 'bg-gold/10 border-gold/40'
                    : 'glass border-white/5 hover:border-white/20'
                }`}
              >
                <div
                  className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    isSelected
                      ? 'gold-gradient text-elite-black'
                      : 'bg-white/5 text-gold'
                  }`}
                >
                  {doc.format === 'yaml' ? <Code2 size={14} /> : doc.order}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium text-white truncate">
                      {doc.title}
                    </h3>
                    <ChevronRight
                      size={14}
                      className={`flex-shrink-0 transition-transform ${
                        isSelected ? 'text-gold translate-x-0.5' : 'opacity-30'
                      }`}
                    />
                  </div>
                  <p className="text-[11px] font-mono text-gold/70 mt-0.5 truncate">
                    {doc.path}
                  </p>
                  <p className="text-xs opacity-50 mt-1.5 line-clamp-2">
                    {doc.summary}
                  </p>
                </div>
              </button>
            );
          })}

          {filteredDocs.length === 0 && (
            <div className="glass p-6 rounded-2xl text-center text-xs opacity-50">
              No blueprint documents match &ldquo;{query}&rdquo;.
            </div>
          )}
        </aside>

        {/* Active Document Reader */}
        <article className="lg:col-span-8 glass rounded-3xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 bg-white/[0.03] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {activeDoc.format === 'yaml' ? (
                <Code2 size={16} className="text-gold flex-shrink-0" />
              ) : (
                <FileText size={16} className="text-gold flex-shrink-0" />
              )}
              <span className="text-xs font-mono text-white/70 truncate">
                {activeDoc.path}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] uppercase tracking-wider font-semibold flex items-center gap-1.5 transition-colors"
              >
                {copied ? (
                  <>
                    <Check size={12} className="text-green" /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={12} /> Copy Raw
                  </>
                )}
              </button>
              <button
                onClick={handleDownload}
                className="px-3.5 py-1.5 rounded-full bg-gold/10 hover:bg-gold hover:text-elite-black text-gold border border-gold/30 text-[11px] uppercase tracking-wider font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Download size={12} /> Download
              </button>
            </div>
          </div>

          <div className="p-6 md:p-8 max-h-[72vh] overflow-y-auto">
            {activeDoc.format === 'yaml' ? (
              <pre className="text-xs font-mono text-white/80 leading-relaxed whitespace-pre-wrap bg-black/40 p-5 rounded-2xl border border-white/10 overflow-x-auto">
                {activeDoc.content}
              </pre>
            ) : (
              <SafeMarkdownContent content={activeDoc.content} />
            )}
          </div>
        </article>
      </div>
    </motion.div>
  );
}
