import { document } from './runtime.js';
import { saveStateToLocalStorage } from './ai-api.js';
import { resumeAnalysisCache } from './resume-analysis.js';
import { SCORING_DIMENSIONS } from './scoring-config.js';
import { displayName, isBlindMode } from './screening-integrity.js';
import { soundEngine } from './sound.js';
import { showPremiumToast } from './sourcing.js';
import { AppState } from './state.js';

// ==========================================
// CANDIDATE COMPARISON & SHORTLIST
// Side-by-side comparison of analysed candidates and a deterministic
// top-N shortlist builder. Ranking arithmetic is done here in code — the
// model only ever scores individuals, never ranks the pool.
// ==========================================

function escAttr(value = '') {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function scoreClass(score) {
  if (score >= 70) return 'score-green';
  if (score >= 45) return 'score-yellow';
  return 'score-red';
}

function dimScore(analysis, key) {
  return analysis?.dimensions?.[key]?.score || 0;
}

// Deterministic ranking with explicit tie-breakers so the order never depends
// on candidate insertion order: weighted score → must-have depth → confidence
// → experience depth → name.
function rankAnalyzedCandidates(job, candidates) {
  return candidates
    .filter(c => resumeAnalysisCache[c.id])
    .map(c => ({ cand: c, analysis: resumeAnalysisCache[c.id] }))
    .sort((x, y) => {
      const a = x.analysis, b = y.analysis;
      if ((b.matchScore || 0) !== (a.matchScore || 0)) return (b.matchScore || 0) - (a.matchScore || 0);
      if (dimScore(b, 'mustHave') !== dimScore(a, 'mustHave')) return dimScore(b, 'mustHave') - dimScore(a, 'mustHave');
      const cf = r => r.confidence?.score || 0;
      if (cf(b) !== cf(a)) return cf(b) - cf(a);
      if (dimScore(b, 'experience') !== dimScore(a, 'experience')) return dimScore(b, 'experience') - dimScore(a, 'experience');
      return (x.cand.name || '').localeCompare(y.cand.name || '');
    })
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

// Marks the top-N eligible (non-rejected) candidates as shortlisted and clears
// the flag on everyone else in this job's pool.
function buildShortlist(job, candidates, topN) {
  const ranked = rankAnalyzedCandidates(job, candidates);
  const eligible = ranked.filter(r => r.analysis.recommendation !== 'Reject');
  const picked = new Set(eligible.slice(0, Math.max(1, topN)).map(r => r.cand.id));
  ranked.forEach(r => { r.cand.shortlisted = picked.has(r.cand.id); });
  job.shortlistSize = topN;
  saveStateToLocalStorage();
  return { ranked, shortlisted: picked };
}

function metricRow(label, cands, valueFn, { bar = false, best = false } = {}) {
  const values = cands.map(c => valueFn(resumeAnalysisCache[c.id], c));
  const numeric = values.every(v => typeof v.sort === 'number');
  const maxVal = best && numeric ? Math.max(...values.map(v => v.sort)) : null;
  const cells = values.map(v => {
    const isBest = best && numeric && v.sort === maxVal && maxVal > 0 && cands.length > 1;
    const barHTML = bar && numeric
      ? `<span class="cmp-bar"><span class="cmp-bar-fill ${scoreClass(v.sort)}" style="width:${v.sort}%"></span></span>`
      : '';
    return `<td class="cmp-cell ${isBest ? 'cmp-best' : ''}">${barHTML}<span class="cmp-cell-val">${v.html}</span>${isBest ? '<span class="cmp-best-tag">Top</span>' : ''}</td>`;
  }).join('');
  return `<tr><th class="cmp-row-label">${label}</th>${cells}</tr>`;
}

function mustHaveCoverage(analysis) {
  const verdicts = (analysis.criteriaVerdicts || []).filter(v => v.group === 'mustHave');
  if (!verdicts.length) return { sort: 0, html: '<span class="cmp-muted">—</span>' };
  const met = verdicts.filter(v => v.met === true || v.met === 'partial').length;
  const pct = Math.round((met / verdicts.length) * 100);
  return { sort: pct, html: `${met}/${verdicts.length} <span class="cmp-muted">(${pct}%)</span>` };
}

function listCell(items, max, emptyText) {
  const arr = (items || []).slice(0, max);
  if (!arr.length) return { sort: 0, html: `<span class="cmp-muted">${emptyText}</span>` };
  return { sort: arr.length, html: `<ul class="cmp-list">${arr.map(i => `<li>${escAttr(i)}</li>`).join('')}</ul>` };
}

function openComparisonOverlay(job, candidateIds) {
  const cands = candidateIds
    .map(id => AppState.candidates.find(c => c.id === id))
    .filter(c => c && resumeAnalysisCache[c.id]);

  if (cands.length < 2) {
    showPremiumToast('Pick at least two analysed candidates to compare.', 'info');
    return;
  }

  document.getElementById('ih-cmp-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'ih-cmp-overlay';
  overlay.className = 'ih-cmp-overlay';

  const headCols = cands.map(c => {
    const a = resumeAnalysisCache[c.id];
    const recCls = a.recommendation === 'Advance' ? 'high' : a.recommendation === 'Hold' ? 'medium' : 'low';
    return `<th class="cmp-cand-head">
      <span class="cmp-cand-name">${escAttr(displayName(c, job))}${c.shortlisted ? ' <span class="cmp-star" title="Shortlisted">★</span>' : ''}</span>
      <span class="cmp-cand-score ${scoreClass(a.matchScore)}">${a.matchScore}%</span>
      <span class="ra-rec-badge ${recCls}">${a.recommendation}</span>
    </th>`;
  }).join('');

  const dimRows = SCORING_DIMENSIONS.map(dim =>
    metricRow(dim.label, cands, a => {
      const s = dimScore(a, dim.key);
      return { sort: s, html: `${s}` };
    }, { bar: true, best: true })
  ).join('');

  overlay.innerHTML = `
    <div class="ih-cmp-modal" role="dialog" aria-label="Candidate comparison">
      <div class="ih-cmp-header">
        <div>
          <h3 class="ih-cmp-title">Compare Candidates</h3>
          <p class="ih-cmp-sub">${cands.length} candidates · ${escAttr(job.roleName || job.cardName || 'Role')}${isBlindMode(job) ? ' · <span class="cmp-blind-note">blind mode</span>' : ''}</p>
        </div>
        <button class="ih-cmp-close" id="ih-cmp-close" title="Close">✕</button>
      </div>
      <div class="ih-cmp-scroll">
        <table class="ih-cmp-table">
          <thead><tr><th class="cmp-corner">Metric</th>${headCols}</tr></thead>
          <tbody>
            ${metricRow('Match Score', cands, a => ({ sort: a.matchScore || 0, html: `<strong>${a.matchScore || 0}%</strong>` }), { best: true })}
            ${metricRow('Confidence', cands, a => {
              const cf = a.confidence;
              return cf ? { sort: cf.score, html: `<span class="cmp-conf ${cf.band.toLowerCase()}">${cf.band} · ${cf.score}%</span>` } : { sort: 0, html: '<span class="cmp-muted">—</span>' };
            }, { best: true })}
            ${metricRow('Experience', cands, a => ({ sort: 0, html: escAttr(a.experienceYears || 'Not stated') }))}
            <tr class="cmp-section-row"><th class="cmp-row-label">Scoring Dimensions</th>${cands.map(() => '<td></td>').join('')}</tr>
            ${dimRows}
            <tr class="cmp-section-row"><th class="cmp-row-label">Coverage & Risk</th>${cands.map(() => '<td></td>').join('')}</tr>
            ${metricRow('Must-Haves Met', cands, a => mustHaveCoverage(a), { best: true })}
            ${metricRow('Red Flags', cands, a => {
              const flags = a.redFlagsDetected || [];
              return flags.length
                ? { sort: -flags.length, html: `<span class="cmp-flag">⚠ ${flags.map(escAttr).join(', ')}</span>` }
                : { sort: 0, html: '<span class="cmp-ok">None</span>' };
            })}
            <tr class="cmp-section-row"><th class="cmp-row-label">Evidence</th>${cands.map(() => '<td></td>').join('')}</tr>
            ${metricRow('Top Strengths', cands, a => listCell(a.strengths, 3, 'No strengths recorded'))}
            ${metricRow('Key Gaps', cands, a => listCell(a.improvements, 3, 'No gaps recorded'))}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  soundEngine.playClick();

  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('#ih-cmp-close')?.addEventListener('click', close);
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  });
}

export { buildShortlist, openComparisonOverlay, rankAnalyzedCandidates };
