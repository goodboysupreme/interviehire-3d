// ==========================================
// RESUME PREPARATION
// Fits a resume into the model's text budget by prioritizing the sections that
// actually drive scoring (experience, projects, skills, education) and dropping
// noise (hobbies, references, declarations) — rather than blindly cutting at a
// fixed offset, which silently loses later experience on long resumes.
// ==========================================

const DEFAULT_BUDGET = 8000;

// rank 1 = highest signal for screening; lower kept first when trimming.
const HEADING_RULES = [
  { rank: 1, re: /^(work experience|professional experience|experience|employment history|career)\b/i },
  { rank: 1, re: /^(projects?|key projects|selected projects|notable work)\b/i },
  { rank: 2, re: /^(technical skills|skills|core competencies|technologies|tech stack)\b/i },
  { rank: 2, re: /^(education|academic background|academics)\b/i },
  { rank: 2, re: /^(certifications?|licenses?|accreditations?)\b/i },
  { rank: 3, re: /^(summary|profile|professional summary|objective|about me?)\b/i },
  { rank: 3, re: /^(achievements?|awards?|honou?rs|publications?|patents?)\b/i },
  { rank: 5, drop: true, re: /^(hobbies|interests|references|declaration|personal details?|languages|address|extra[\s-]?curricular|family details?|nationality)\b/i },
];

function classifyHeading(line) {
  if (!line || line.length > 60) return null;
  for (const rule of HEADING_RULES) {
    if (rule.re.test(line)) return rule;
  }
  return null;
}

function splitSections(text) {
  const lines = text.split('\n');
  const sections = [];
  // Pre-heading block: contact, name, headline — high value, keep with rank 1.
  let current = { heading: '(header)', rank: 1, drop: false, lines: [] };
  for (const line of lines) {
    const rule = classifyHeading(line.trim());
    if (rule) {
      sections.push(current);
      current = { heading: line.trim(), rank: rule.rank, drop: !!rule.drop, lines: [line] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);
  return sections.filter(s => s.lines.length);
}

// Returns { text, truncated, droppedSections }. Never returns more than `budget`
// characters; preserves original section order in the output.
function prepareResumeForAnalysis(text, budget = DEFAULT_BUDGET) {
  const full = String(text || '');
  if (full.length <= budget) return { text: full, truncated: false, droppedSections: [] };

  const sections = splitSections(full);
  const order = new Map(sections.map((s, i) => [s, i]));
  const dropped = [];

  // 1. Drop pure-noise sections outright.
  let kept = sections.filter(s => {
    if (s.drop) { dropped.push(s.heading); return false; }
    return true;
  });

  const assemble = list => list
    .slice()
    .sort((a, b) => order.get(a) - order.get(b))
    .map(s => s.lines.join('\n'))
    .join('\n');

  let assembled = assemble(kept);
  if (assembled.length <= budget) {
    return { text: assembled, truncated: dropped.length > 0, droppedSections: dropped };
  }

  // 2. Still over budget: include sections by priority until the budget fills.
  const byPriority = kept.slice().sort((a, b) => a.rank - b.rank || order.get(a) - order.get(b));
  const fit = [];
  let used = 0;
  for (const s of byPriority) {
    const block = s.lines.join('\n');
    if (used + block.length + 1 <= budget) {
      fit.push(s);
      used += block.length + 1;
    } else {
      dropped.push(s.heading);
    }
  }

  let result = assemble(fit);
  if (result.length > budget) result = result.slice(0, budget); // final safety clamp
  return { text: result, truncated: true, droppedSections: dropped.filter(Boolean) };
}

export { prepareResumeForAnalysis };
