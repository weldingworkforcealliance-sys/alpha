'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  HELP_ITEMS,
  type HelpCategory,
  searchHelpItems,
} from '@/lib/help-content';
import styles from './help.module.css';

const ALL_CATEGORIES = 'All Topics';

export default function HelpCenterPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);

  const categories = useMemo(
    () => Array.from(new Set(HELP_ITEMS.map((item) => item.category))).sort((a, b) => a.localeCompare(b)),
    []
  );

  const filtered = useMemo(() => {
    const searched = searchHelpItems(query);
    if (category === ALL_CATEGORIES) return searched;
    return searched.filter((item) => item.category === (category as HelpCategory));
  }, [category, query]);

  const guides = filtered.filter((item) => item.kind === 'guide');
  const qa = filtered.filter((item) => item.kind === 'qa');

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.eyebrow}>LTG Help Center</div>
        <h1>How can we help?</h1>
        <p>Search simple LTG instructions, common questions, and current permission limits.</p>

        <div className={styles.searchRow}>
          <label className={styles.searchBox}>
            <span className={styles.srOnly}>Search LTG Help</span>
            <span aria-hidden="true" className={styles.searchIcon}>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search: attendance, roster, instructor, clock in…" autoComplete="off" />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">Clear</button>}
          </label>

          <label className={styles.topicFilter}>
            <span>Topic</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option>{ALL_CATEGORIES}</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>

        <div className={styles.resultSummary} aria-live="polite">
          {filtered.length} help {filtered.length === 1 ? 'result' : 'results'}{query ? ` for “${query}”` : ''}
        </div>
      </header>

      {filtered.length === 0 ? (
        <section className={styles.emptyState}>
          <strong>No matching LTG help article yet.</strong>
          <p>Try a shorter search phrase or choose All Topics.</p>
        </section>
      ) : (
        <>
          {guides.length > 0 && (
            <section className={styles.section} aria-labelledby="quick-guides-heading">
              <div className={styles.sectionHeader}>
                <div><div className={styles.kicker}>Simple tasks</div><h2 id="quick-guides-heading">Quick Guides</h2></div>
                <span>{guides.length}</span>
              </div>

              <div className={styles.guideGrid}>
                {guides.map((item) => (
                  <article className={styles.guideCard} key={item.id}>
                    <div className={styles.cardMeta}><span>{item.category}</span><span>{item.audience.join(' · ')}</span></div>
                    <h3>{item.title}</h3>
                    <p>{item.summary}</p>
                    <ol>{item.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                    {item.note && <div className={styles.note}>{item.note}</div>}
                    {item.route && <Link className={styles.openLink} href={item.route}>Open this LTG area →</Link>}
                  </article>
                ))}
              </div>
            </section>
          )}

          {qa.length > 0 && (
            <section className={styles.section} aria-labelledby="qa-heading">
              <div className={styles.sectionHeader}>
                <div><div className={styles.kicker}>Searchable answers</div><h2 id="qa-heading">Questions &amp; Answers</h2></div>
                <span>{qa.length}</span>
              </div>

              <div className={styles.qaList}>
                {qa.map((item) => (
                  <details className={styles.qaItem} key={item.id} open={Boolean(query)}>
                    <summary>
                      <span><small>{item.category}</small><strong>{item.question}</strong></span>
                      <span aria-hidden="true" className={styles.chevron}>⌄</span>
                    </summary>
                    <div className={styles.qaBody}>
                      <p>{item.answer}</p>
                      {item.steps?.length ? <ol>{item.steps.map((step) => <li key={step}>{step}</li>)}</ol> : null}
                      {item.note && <div className={styles.note}>{item.note}</div>}
                      <div className={styles.qaFooter}>
                        <span>For: {item.audience.join(' · ')}</span>
                        {item.route && <Link className={styles.openLink} href={item.route}>Open this LTG area →</Link>}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <footer className={styles.footerNote}>
        <strong>Help content rule:</strong> LTG help explains the system as it currently works. If a permission or feature is not available to a role, the answer should state that plainly rather than describing a button that does not exist.
      </footer>
    </main>
  );
}
