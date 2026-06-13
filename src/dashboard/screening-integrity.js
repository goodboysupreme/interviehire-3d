// ==========================================
// SCREENING INTEGRITY
// Blind screening (PII redaction + anonymized identity) and analysis
// confidence scoring. Kept dependency-light on purpose — every function is
// pure and takes what it needs as arguments, so this module never forms an
// import cycle with the analysis/render layers that consume it.
// ==========================================

// ── Blind mode ────────────────────────────────────────────────────────────

function isBlindMode(job) {
  return !!(job && job.blindMode);
}

// Stable, PII-free label derived from the candidate id. Same id always maps to
// the same label so a recruiter can still track a row across renders.
function anonLabel(cid = '') {
  let h = 2166136261;
  for (let i = 0; i < cid.length; i++) {
    h ^= cid.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const code = (h >>> 0).toString(36).toUpperCase().padStart(4, '0').slice(0, 4);
  return `Candidate ${code}`;
}

function displayName(cand, job) {
  if (isBlindMode(job)) return anonLabel(cand?.id || '');
  return cand?.name || anonLabel(cand?.id || '');
}

function escapeRe(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const REDACTION_PATTERNS = [
  { key: 'email', token: '[EMAIL REDACTED]', re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi },
  { key: 'link', token: '[LINK REDACTED]', re: /\b(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|gitlab\.com|behance\.net|twitter\.com|x\.com|medium\.com)\/[^\s)]+/gi },
  { key: 'phone', token: '[PHONE REDACTED]', re: /(?:\+?\d[\d\s().-]{8,}\d)/g },
  { key: 'institution', token: '[INSTITUTION REDACTED]', re: /\b(?:[A-Z][\w&.'-]+(?:\s+[A-Z][\w&.'-]+){0,4}\s+)?(?:University|Institute of Technology|Institute|College|Polytechnic|School of [A-Z][\w]+)\b/g },
  { key: 'demographic', token: '$1: [REDACTED]', re: /\b(Date of Birth|D\.?O\.?B|Age|Gender|Sex|Marital Status|Nationality|Religion)\b\s*[:\-]\s*[^\n]*/gi },
  { key: 'honorific', token: '', re: /\b(?:Mr|Mrs|Ms|Miss|Sir|Madam)\.?\s+/g },
];

// Redacts identity- and pedigree-revealing content before the resume reaches
// the model, so the score reflects substance, not name/school/contact signals.
function redactResumeText(text = '', identity = {}) {
  let redacted = String(text);
  const counts = {};
  const bump = (key, n) => { if (n) counts[key] = (counts[key] || 0) + n; };

  // Structured PII first so full emails/links/phones are masked as a unit before
  // name redaction can fragment them (e.g. a name inside an email local-part).
  REDACTION_PATTERNS.forEach(({ key, token, re }) => {
    const matches = redacted.match(re);
    if (matches) { bump(key, matches.length); redacted = redacted.replace(re, token); }
  });

  const name = (identity.name || '').trim();
  if (name.length > 1) {
    const parts = [...new Set([name, ...name.split(/\s+/)])].filter(p => p.length > 1);
    parts.forEach(part => {
      const re = new RegExp(`\\b${escapeRe(part)}\\b`, 'gi');
      const matches = redacted.match(re);
      if (matches) { bump('name', matches.length); redacted = redacted.replace(re, '[NAME REDACTED]'); }
    });
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { text: redacted, total, counts };
}

// ── Confidence + review flags ───────────────────────────────────────────────

const SHORT_RESUME = 1500;
const VERY_SHORT_RESUME = 600;
const BORDERLINE_MARGIN = 4;

// Confidence is computed in code from observable signals (engine, evidence
// density, resume length) — never asked of the model, which would just
// rationalize its own output.
function computeConfidence(result, resumeText = '') {
  const reasons = [];
  let score = 100;
  const len = String(resumeText || '').trim().length;

  if (result.engine === 'local') {
    score -= 30;
    reasons.push('Scored by the local fallback engine (AI analyst was offline)');
  }
  if (len > 0 && len < VERY_SHORT_RESUME) {
    score -= 35;
    reasons.push('Very little resume text to work with — evidence is thin');
  } else if (len > 0 && len < SHORT_RESUME) {
    score -= 15;
    reasons.push('Short resume — limited evidence base');
  }

  const verdicts = Array.isArray(result.criteriaVerdicts) ? result.criteriaVerdicts : [];
  if (verdicts.length) {
    const grounded = verdicts.filter(v => v.evidence && v.evidence.trim().length > 12).length;
    const ratio = grounded / verdicts.length;
    if (ratio < 0.5) { score -= 20; reasons.push('Most criteria verdicts lack concrete evidence'); }
    else if (ratio < 0.8) { score -= 8; reasons.push('Some criteria verdicts lack concrete evidence'); }
  } else {
    score -= 10;
    reasons.push('No screening criteria configured to anchor the score');
  }

  const dims = result.dimensions && typeof result.dimensions === 'object' ? result.dimensions : {};
  const groundedDims = Object.values(dims).filter(d => d && d.evidence && d.evidence.trim().length > 8).length;
  if (groundedDims < 3) {
    score -= 12;
    reasons.push('Few scoring dimensions carry supporting evidence');
  }

  score = Math.max(5, Math.min(100, Math.round(score)));
  const band = score >= 75 ? 'High' : score >= 50 ? 'Medium' : 'Low';
  if (reasons.length === 0) reasons.push('Strong, evidence-backed coverage across criteria and dimensions');
  return { score, band, reasons };
}

// Surfaces analyses a human should look at: low confidence, or a score sitting
// right on a decision threshold where a point either way flips the outcome.
function computeReviewFlag(result, config) {
  const reasons = [];
  const confidence = result.confidence;
  const score = result.matchScore;
  const thresholds = (config && config.thresholds) || {};

  if (confidence && confidence.band === 'Low') reasons.push('Low confidence in this analysis');
  if (typeof score === 'number' && typeof thresholds.advance === 'number' && Math.abs(score - thresholds.advance) <= BORDERLINE_MARGIN) {
    reasons.push(`Score sits on the Advance line (${thresholds.advance})`);
  }
  if (typeof score === 'number' && typeof thresholds.hold === 'number' && Math.abs(score - thresholds.hold) <= BORDERLINE_MARGIN) {
    reasons.push(`Score sits on the Hold line (${thresholds.hold})`);
  }

  return { needsReview: reasons.length > 0, reasons };
}

// Writes confidence + review flag onto a finished analysis result.
function annotateConfidence(result, config, resumeText) {
  result.confidence = computeConfidence(result, resumeText);
  const review = computeReviewFlag(result, config);
  result.needsReview = review.needsReview;
  result.reviewReasons = review.reasons;
  return result;
}

export {
  anonLabel,
  annotateConfidence,
  computeConfidence,
  computeReviewFlag,
  displayName,
  isBlindMode,
  redactResumeText,
};
