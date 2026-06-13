import { document } from './runtime.js';
import { saveStateToLocalStorage } from './ai-api.js';
import { getScoringConfig, recommendationFromScore } from './scoring-config.js';
import { displayName, isBlindMode } from './screening-integrity.js';
import { soundEngine } from './sound.js';
import { showPremiumToast } from './sourcing.js';
import { AppState } from './state.js';

// ==========================================
// INTERVIEW SCORECARD
// Closes the screen → interview → decision loop: the analyst's interview probes
// and role competencies become a structured scorecard the interviewer fills in,
// and the ratings re-score the candidate by blending fresh interview signal with
// the original resume match score. Blending math is done in code, not the model.
// ==========================================

const RESUME_WEIGHT = 0.45;
const INTERVIEW_WEIGHT = 0.55;

const RATING_SCALE = [
  { v: 0, label: 'Poor' },
  { v: 1, label: 'Weak' },
  { v: 2, label: 'Mixed' },
  { v: 3, label: 'Strong' },
  { v: 4, label: 'Excellent' },
];

function escAttr(value = '') {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function resumeScoreOf(candidate) {
  const a = candidate.resumeAnalysis;
  if (a && typeof a.matchScore === 'number') return a.matchScore;
  const parsed = parseInt(String(candidate.score || '').replace('%', ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

// Derives scorecard items from the resume analysis — competencies to rate and
// probes to verify — falling back to generic dimensions when no analysis exists.
function buildScorecardItems(candidate) {
  const existing = candidate.interviewScorecard?.items;
  if (Array.isArray(existing) && existing.length) {
    return existing.map(i => ({ ...i }));
  }

  const a = candidate.resumeAnalysis || {};
  const items = [];
  (a.competencies || []).slice(0, 6).forEach((c, i) => {
    items.push({ id: `comp-${i}`, kind: 'competency', label: c.name, hint: (c.bullets || [])[0] || '', rating: null, note: '' });
  });
  (a.interviewProbes || []).slice(0, 5).forEach((p, i) => {
    items.push({ id: `probe-${i}`, kind: 'probe', label: p, hint: 'Verify weak resume evidence', rating: null, note: '' });
  });
  if (!items.length) {
    ['Technical depth', 'Communication', 'Role fit', 'Problem solving'].forEach((label, i) => {
      items.push({ id: `gen-${i}`, kind: 'general', label, hint: '', rating: null, note: '' });
    });
  }
  return items;
}

function computeBlendedScore(resumeScore, items) {
  const rated = items.filter(i => typeof i.rating === 'number');
  const interviewScore = rated.length
    ? Math.round((rated.reduce((s, i) => s + i.rating, 0) / rated.length / 4) * 100)
    : null;

  let blended;
  if (interviewScore == null) blended = resumeScore;
  else if (resumeScore == null) blended = interviewScore;
  else blended = Math.round(RESUME_WEIGHT * resumeScore + INTERVIEW_WEIGHT * interviewScore);

  return { interviewScore, blended, ratedCount: rated.length, totalCount: items.length };
}

function fitFromScore(score, job) {
  const rec = recommendationFromScore(score, getScoringConfig(job));
  return rec === 'Advance' ? 'Good fit' : rec === 'Hold' ? 'Moderate fit' : 'Poor fit';
}

function scoreClass(score) {
  if (score == null) return '';
  if (score >= 70) return 'score-green';
  if (score >= 45) return 'score-yellow';
  return 'score-red';
}

function kindBadge(kind) {
  if (kind === 'competency') return '<span class="isc-kind comp">Competency</span>';
  if (kind === 'probe') return '<span class="isc-kind probe">Probe</span>';
  return '<span class="isc-kind">Criterion</span>';
}

// Opens the interactive scorecard. onSave is called after persistence so the
// caller can re-render the stage table with the new score.
function openInterviewScorecard(cid, job, onSave) {
  const candidate = AppState.candidates.find(c => c.id === cid);
  if (!candidate) return;

  const items = buildScorecardItems(candidate);
  const resumeScore = resumeScoreOf(candidate);

  document.getElementById('isc-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'isc-overlay';
  overlay.className = 'isc-overlay';

  const itemRows = items.map((item, idx) => `
    <div class="isc-item" data-idx="${idx}">
      <div class="isc-item-head">
        ${kindBadge(item.kind)}
        <span class="isc-item-label">${escAttr(item.label)}</span>
      </div>
      ${item.hint ? `<p class="isc-item-hint">${escAttr(item.hint)}</p>` : ''}
      <div class="isc-rating" role="radiogroup" aria-label="Rating for ${escAttr(item.label)}">
        ${RATING_SCALE.map(r => `<button type="button" class="isc-rate ${item.rating === r.v ? 'on' : ''}" data-idx="${idx}" data-val="${r.v}" title="${r.label}">${r.label}</button>`).join('')}
      </div>
      <input type="text" class="isc-note" data-idx="${idx}" placeholder="Evidence / notes (optional)…" value="${escAttr(item.note || '')}" />
    </div>
  `).join('');

  overlay.innerHTML = `
    <div class="isc-modal" role="dialog" aria-label="Interview scorecard">
      <div class="isc-header">
        <div>
          <h3 class="isc-title">Interview Scorecard</h3>
          <p class="isc-sub">${escAttr(displayName(candidate, job))}${isBlindMode(job) ? ' · <span class="cmp-blind-note">blind</span>' : ''} · ${escAttr(job.roleName || job.cardName || 'Role')}</p>
        </div>
        <button class="isc-close" id="isc-close" title="Close">✕</button>
      </div>

      <div class="isc-scoreboard">
        <div class="isc-stat"><span class="isc-stat-label">Resume match</span><span class="isc-stat-val ${scoreClass(resumeScore)}">${resumeScore != null ? resumeScore + '%' : '—'}</span></div>
        <div class="isc-stat"><span class="isc-stat-label">Interview</span><span class="isc-stat-val" id="isc-interview-score">—</span></div>
        <div class="isc-stat blended"><span class="isc-stat-label">Blended</span><span class="isc-stat-val" id="isc-blended-score">—</span></div>
        <div class="isc-progress" id="isc-progress">0 / ${items.length} rated</div>
      </div>

      <div class="isc-body">${itemRows}</div>

      <div class="isc-footer">
        <div class="isc-decision">
          <span>Decision</span>
          <select id="isc-decision">
            <option value="auto">Auto (from blended score)</option>
            <option value="Advance">Advance</option>
            <option value="Hold">Hold</option>
            <option value="Reject">Reject</option>
          </select>
        </div>
        <button class="isc-save" id="isc-save" disabled>Save scorecard</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  soundEngine.playClick();

  const recompute = () => {
    const { interviewScore, blended, ratedCount } = computeBlendedScore(resumeScore, items);
    const ivEl = overlay.querySelector('#isc-interview-score');
    const blEl = overlay.querySelector('#isc-blended-score');
    ivEl.textContent = interviewScore != null ? interviewScore + '%' : '—';
    ivEl.className = `isc-stat-val ${scoreClass(interviewScore)}`;
    blEl.textContent = blended != null ? blended + '%' : '—';
    blEl.className = `isc-stat-val ${scoreClass(blended)}`;
    overlay.querySelector('#isc-progress').textContent = `${ratedCount} / ${items.length} rated`;
    overlay.querySelector('#isc-save').disabled = ratedCount === 0;
  };

  overlay.querySelectorAll('.isc-rate').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const val = parseInt(btn.dataset.val, 10);
      items[idx].rating = items[idx].rating === val ? null : val;
      overlay.querySelectorAll(`.isc-rate[data-idx="${idx}"]`).forEach(b => {
        b.classList.toggle('on', parseInt(b.dataset.val, 10) === items[idx].rating);
      });
      soundEngine.playClick();
      recompute();
    });
  });
  overlay.querySelectorAll('.isc-note').forEach(input => {
    input.addEventListener('input', () => { items[parseInt(input.dataset.idx, 10)].note = input.value; });
  });

  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('#isc-close').addEventListener('click', close);
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  });

  overlay.querySelector('#isc-save').addEventListener('click', () => {
    const { interviewScore, blended } = computeBlendedScore(resumeScore, items);
    const decisionChoice = overlay.querySelector('#isc-decision').value;
    const recommendation = decisionChoice === 'auto'
      ? recommendationFromScore(blended ?? 0, getScoringConfig(job))
      : decisionChoice;

    candidate.interviewScorecard = {
      items: items.map(i => ({ ...i })),
      interviewScore,
      blended,
      recommendation,
      scoredAt: new Date().toISOString(),
    };
    candidate.interviewScore = blended;
    candidate.interviewStatus = 'Completed';
    candidate.recruiterScreening = fitFromScore(blended ?? 0, job);
    saveStateToLocalStorage();
    soundEngine.playChime([523.25, 659.25, 783.99], 0.12, 0.08);
    showPremiumToast(`Scorecard saved — ${displayName(candidate, job)} re-scored to ${blended}% → ${recommendation}.`, 'success');
    close();
    if (typeof onSave === 'function') onSave(candidate);
  });

  recompute();
}

export { buildScorecardItems, computeBlendedScore, openInterviewScorecard };
