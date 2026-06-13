import { callDeepSeekAPI, sanitizeJSONResponse, saveStateToLocalStorage } from './ai-api.js';
import { DEFAULT_SCORING_CONFIG, getScoringConfig } from './scoring-config.js';

// ==========================================
// RUBRIC GENERATOR
// Turns a job description into a complete scoring rubric — screening criteria,
// role-tuned dimension weights, custom criteria and thresholds — so a recruiter
// can go from a blank config to a defensible rubric in one click. AI-first with
// a deterministic local heuristic fallback.
// ==========================================

const SENIOR_RE = /\b(senior|sr\.?|lead|principal|staff|head|director|architect|manager|vp)\b/i;
const JUNIOR_RE = /\b(junior|jr\.?|entry|fresher|intern|trainee|associate|graduate)\b/i;

function experienceYears(job) {
  const m = String(job.experienceBand || '').match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

// Weight presets reflect what actually predicts success at each level:
// seniors are judged on demonstrated work, juniors on fundamentals + must-haves.
function seniorityWeights(job) {
  const yrs = experienceYears(job);
  const text = `${job.roleName || ''} ${job.cardName || ''}`;
  const isSenior = SENIOR_RE.test(text) || (yrs != null && yrs >= 6);
  const isJunior = JUNIOR_RE.test(text) || (yrs != null && yrs <= 2);

  if (isSenior) {
    return { weights: { mustHave: 28, niceToHave: 7, projects: 30, experience: 22, education: 3, custom: 10 }, band: 'senior' };
  }
  if (isJunior) {
    return { weights: { mustHave: 34, niceToHave: 12, projects: 18, experience: 9, education: 17, custom: 10 }, band: 'entry-level' };
  }
  return { weights: { ...DEFAULT_SCORING_CONFIG.weights }, band: 'mid-level' };
}

function buildLocalRubric(job) {
  const { weights, band } = seniorityWeights(job);
  const existing = job.resumeCriteria || {};
  return {
    resumeCriteria: {
      mustHave: Array.isArray(existing.mustHave) ? existing.mustHave : [],
      goodToHave: Array.isArray(existing.goodToHave) ? existing.goodToHave : [],
      redFlags: Array.isArray(existing.redFlags) ? existing.redFlags : [],
      goodToHaveMinMatch: existing.goodToHaveMinMatch || 1,
    },
    customCriteria: [],
    weights,
    thresholds: { ...DEFAULT_SCORING_CONFIG.thresholds },
    rationale: `Weights tuned locally for a ${band} role${experienceYears(job) != null ? ` (~${experienceYears(job)}y band)` : ''}. Connect the AI analyst to also draft criteria and custom checks.`,
    engine: 'local',
  };
}

function clampWeight(v, fallback) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 50 ? n : fallback;
}

function normalizeRubric(parsed, job) {
  const local = buildLocalRubric(job);
  const dims = ['mustHave', 'niceToHave', 'projects', 'experience', 'education', 'custom'];
  const weights = {};
  dims.forEach(k => { weights[k] = clampWeight(parsed?.weights?.[k], local.weights[k]); });

  // Generous bound only as an abuse guard — the count is JD-driven, not fixed.
  const asArr = (v, max = 25) => Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean).slice(0, max) : [];
  const advance = clampWeight(parsed?.thresholds?.advance, DEFAULT_SCORING_CONFIG.thresholds.advance);
  const hold = Math.min(advance - 1, clampWeight(parsed?.thresholds?.hold, DEFAULT_SCORING_CONFIG.thresholds.hold));

  return {
    resumeCriteria: {
      mustHave: asArr(parsed?.mustHave).length ? asArr(parsed.mustHave) : local.resumeCriteria.mustHave,
      goodToHave: asArr(parsed?.goodToHave).length ? asArr(parsed.goodToHave) : local.resumeCriteria.goodToHave,
      redFlags: asArr(parsed?.redFlags).length ? asArr(parsed.redFlags) : local.resumeCriteria.redFlags,
      goodToHaveMinMatch: local.resumeCriteria.goodToHaveMinMatch,
    },
    customCriteria: (Array.isArray(parsed?.customCriteria) ? parsed.customCriteria : []).slice(0, 12).map((c, i) => ({
      id: `cc-jd-${i}`,
      label: String(c?.label || '').trim(),
      description: String(c?.description || '').trim(),
      weight: Math.max(1, Math.min(10, Math.round(Number(c?.weight)) || 5)),
    })).filter(c => c.label),
    weights,
    thresholds: { advance: Math.max(1, advance), hold: Math.max(0, hold) },
    rationale: parsed?.rationale ? String(parsed.rationale) : local.rationale,
    engine: 'deepseek',
  };
}

const RUBRIC_PROMPT = `You are an expert technical recruiter building a resume-screening rubric for a specific role. From the job description, produce a complete, defensible scoring rubric.

Return ONLY valid JSON, no markdown fences:
{
  "mustHave": ["essential, evidence-checkable requirements"],
  "goodToHave": ["bonus qualifications"],
  "redFlags": ["disqualifying signals specific to this role"],
  "customCriteria": [{"label": "short name", "description": "what strong evidence looks like", "weight": 1-10}],
  "weights": {"mustHave": 0-50, "niceToHave": 0-50, "projects": 0-50, "experience": 0-50, "education": 0-50, "custom": 0-50},
  "thresholds": {"advance": 0-100, "hold": 0-100},
  "rationale": "1-2 sentences on why these weights fit THIS role's seniority and nature"
}

Rules:
- List exactly as many must-haves and nice-to-haves as the JD genuinely implies — do NOT pad to a number or trim to one. A focused JD may yield 3; a dense one may yield 12+. Let the description drive the count.
- Weight the dimensions for the role: seniors lean on projects + experience; entry roles lean on must-haves + education.
- customCriteria: role-specific checks not already covered by the dimensions (e.g. "Worked in a regulated industry").
- Be concrete and role-specific. No generic filler.`;

async function generateRubricFromJD(job) {
  const jd = (job.description || '').trim();
  if (!jd) {
    return { applied: buildLocalRubric(job), engine: 'local', reason: 'no-jd' };
  }

  let rubric;
  try {
    const raw = await callDeepSeekAPI([
      { role: 'system', content: RUBRIC_PROMPT },
      { role: 'user', content: `ROLE: ${job.roleName || job.cardName || 'Role'}\nExperience band: ${job.experienceBand || 'unspecified'}\n\nJOB DESCRIPTION:\n${jd.slice(0, 2800)}` },
    ], true);
    rubric = normalizeRubric(JSON.parse(sanitizeJSONResponse(raw)), job);
  } catch (err) {
    console.warn('Rubric AI generation failed, using local heuristic:', err);
    rubric = buildLocalRubric(job);
  }

  applyRubric(job, rubric);
  return { applied: rubric, engine: rubric.engine };
}

// Merges the generated rubric onto the job, preserving any custom criteria the
// recruiter already authored by hand (appended after the generated ones).
function applyRubric(job, rubric) {
  job.resumeCriteria = rubric.resumeCriteria;
  const prior = getScoringConfig(job);
  const manualCustom = (prior.customCriteria || []).filter(c => !String(c.id || '').startsWith('cc-jd-'));
  job.scoringConfig = {
    weights: rubric.weights,
    thresholds: rubric.thresholds,
    mustHaveGate: prior.mustHaveGate,
    mustHaveCap: prior.mustHaveCap,
    customCriteria: [...rubric.customCriteria, ...manualCustom],
  };
  saveStateToLocalStorage();
}

export { buildLocalRubric, generateRubricFromJD };
