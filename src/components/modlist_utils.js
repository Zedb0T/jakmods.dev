import React from 'react';
import Parser from 'html-react-parser';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './modlist.module.css';

const PLATFORM_LABELS = {
  windows: 'Windows',
  linux: 'Linux',
  macos: 'macOS',
};

function collectMods(game, data) {
  const mods = [];
  for (const modId in data.mods) {
    const mod = data.mods[modId];

    if (mod.externalLink) continue;

    const games = [...new Set(mod.supportedGames || [])];
    if (!games.includes(game)) continue;

    const tags = [...(mod.tags || [])].sort();
    if (tags.includes('hidden') || tags.includes('external')) continue;

    const cfg = (mod.perGameConfig && mod.perGameConfig[game]) || {};

    let downloads = 0;
    const platforms = new Set();
    for (const version of mod.versions || []) {
      for (const platform in version.assets || {}) {
        if (version.assets[platform]) platforms.add(platform);
      }
      for (const platform in version.assetDownloadCounts || {}) {
        const count = parseInt(version.assetDownloadCounts[platform], 10);
        if (!isNaN(count)) downloads += count;
      }
    }

    mods.push({
      id: modId,
      name: cfg.displayName || mod.displayName || modId,
      description: cfg.description || mod.description || '',
      authors: mod.authors || [],
      tags,
      platforms: [...platforms],
      releaseDate: (cfg.releaseDate || '').substring(0, 10),
      downloads,
      websiteUrl: mod.websiteUrl,
      // some cover art URLs are dead; card falls back through this list
      images: [
        ...new Set(
          [cfg.coverArtUrl, mod.coverArtUrl, cfg.thumbnailArtUrl, mod.thumbnailArtUrl].filter(Boolean)
        ),
      ],
    });
  }

  // recent releases first
  return mods.sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
}

// stable per-mod hue so placeholder cards don't all look identical
function nameHue(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

// tries each candidate URL in order, then falls back to a gradient placeholder
function ModImage({ mod }) {
  const [imgIdx, setImgIdx] = React.useState(0);
  const hue = nameHue(mod.name);

  if (imgIdx < mod.images.length) {
    return (
      <img
        src={mod.images[imgIdx]}
        alt={mod.name}
        loading="lazy"
        onError={() => setImgIdx(imgIdx + 1)}
      />
    );
  }
  return (
    <div
      className={styles.placeholder}
      style={{ background: `linear-gradient(135deg, hsl(${hue}, 55%, 45%), hsl(${(hue + 40) % 360}, 60%, 30%))` }}
    >
      {mod.name.charAt(0).toUpperCase()}
    </div>
  );
}

function ModCard({ mod }) {
  const image = <ModImage mod={mod} />;

  return (
    <article className={styles.card}>
      <div className={styles.imageWrap}>
        {mod.websiteUrl ? (
          <a href={mod.websiteUrl} target="_blank" rel="noopener noreferrer">
            {image}
          </a>
        ) : (
          image
        )}
        <div className={styles.platforms}>
          {mod.platforms.map((platform) => (
            <span key={platform} className={styles.platform}>
              {PLATFORM_LABELS[platform] || platform}
            </span>
          ))}
        </div>
      </div>
      <div className={styles.body}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>
            {mod.websiteUrl ? (
              <a href={mod.websiteUrl} target="_blank" rel="noopener noreferrer">
                {mod.name}
              </a>
            ) : (
              mod.name
            )}
          </h3>
          <span className={styles.date}>{mod.releaseDate}</span>
        </div>
        {mod.authors.length > 0 && <div className={styles.byline}>by {mod.authors.join(', ')}</div>}
        <p className={styles.desc}>{Parser(mod.description)}</p>
        {mod.tags.length > 0 && (
          <div className={styles.tags}>
            {mod.tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className={styles.footer}>
          <span className={styles.downloads} title="Total downloads">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 16l-6-6h4V4h4v6h4l-6 6zm-8 2h16v2H4v-2z" />
            </svg>
            {mod.downloads.toLocaleString()}
          </span>
          {mod.websiteUrl && (
            <a className={styles.website} href={mod.websiteUrl} target="_blank" rel="noopener noreferrer">
              Website ↗
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function ModTable({ mods }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th></th>
            <th>Name</th>
            <th>Description</th>
            <th>Contributors</th>
            <th>Tags</th>
            <th>Platforms</th>
            <th>Released</th>
            <th>Downloads</th>
            <th>Website</th>
          </tr>
        </thead>
        <tbody>
          {mods.map((mod) => (
            <tr key={mod.id}>
              <td className={styles.tableImageCell}>
                <div className={styles.tableImage}>
                  <ModImage mod={mod} />
                </div>
              </td>
              <td className={styles.tableName}>{mod.name}</td>
              <td>{Parser(mod.description)}</td>
              <td>{mod.authors.join(', ')}</td>
              <td>{mod.tags.join(', ')}</td>
              <td>{mod.platforms.map((p) => PLATFORM_LABELS[p] || p).join(', ')}</td>
              <td className={styles.tableNowrap}>{mod.releaseDate}</td>
              <td>{mod.downloads.toLocaleString()}</td>
              <td>
                {mod.websiteUrl ? (
                  <a href={mod.websiteUrl} target="_blank" rel="noopener noreferrer">
                    Website
                  </a>
                ) : (
                  'N/A'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const VIEW_STORAGE_KEY = 'jakmods-modlist-view';

function ModListTable(props) {
  const [data, setData] = React.useState(null);
  const [query, setQuery] = React.useState('');
  const [view, setView] = React.useState('cards');
  const modsUrl = useBaseUrl('/mods.json'); // file lives in the static folder

  React.useEffect(() => {
    fetch(modsUrl)
      .then((res) => res.json())
      .then((jsonData) => setData(jsonData))
      .catch((error) => console.error('Error fetching data:', error));
  }, [modsUrl]);

  // read saved preference after mount so SSR markup stays consistent
  React.useEffect(() => {
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved === 'cards' || saved === 'table') setView(saved);
  }, []);

  const switchView = (next) => {
    setView(next);
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  };

  if (!data) {
    return <div>Loading data...</div>;
  }

  const mods = collectMods(props.game, data);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? mods.filter((mod) =>
        [mod.name, mod.description, mod.authors.join(' '), mod.tags.join(' ')]
          .join(' ')
          .toLowerCase()
          .includes(q)
      )
    : mods;

  return (
    <div>
      <div className={styles.toolbar}>
        <input
          type="search"
          className={styles.search}
          placeholder="Search mods, tags, authors..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className={styles.count}>
          {filtered.length} mod{filtered.length === 1 ? '' : 's'}
        </span>
        <div className={styles.viewToggle} role="group" aria-label="View style">
          <button
            type="button"
            className={view === 'cards' ? styles.viewButtonActive : styles.viewButton}
            aria-pressed={view === 'cards'}
            onClick={() => switchView('cards')}
          >
            Cards
          </button>
          <button
            type="button"
            className={view === 'table' ? styles.viewButtonActive : styles.viewButton}
            aria-pressed={view === 'table'}
            onClick={() => switchView('table')}
          >
            Table
          </button>
        </div>
      </div>
      {filtered.length > 0 ? (
        view === 'table' ? (
          <ModTable mods={filtered} />
        ) : (
          <div className={styles.grid}>
            {filtered.map((mod) => (
              <ModCard key={mod.id} mod={mod} />
            ))}
          </div>
        )
      ) : (
        <div className={styles.empty}>No mods match your search.</div>
      )}
    </div>
  );
}

export default ModListTable;
