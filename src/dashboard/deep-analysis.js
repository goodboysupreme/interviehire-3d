import { auditJobDescriptionLocally, optimizeJobDescriptionWithAI } from './ai-api.js';
import { escapeHTML } from './escape.js';
import { filterCandidatesByDateRange } from './render-views.js';
import { resumeAnalysisCache, resumeTextCache } from './resume-analysis.js';
import { AppState } from './state.js';

function checkSkillStatus(cand, skillText, isMustHave) {
  const analysis = resumeAnalysisCache[cand.id];
  if (!analysis) return 'pending';

  const cleanSkill = skillText.toLowerCase().trim();
  
  const inMatched = analysis.skills?.matched?.some(s => {
    const sLower = s.toLowerCase();
    return sLower.includes(cleanSkill) || cleanSkill.includes(sLower);
  });
  if (inMatched) return 'yes';

  const inMissing = analysis.skills?.missing?.some(s => {
    const sLower = s.toLowerCase();
    return sLower.includes(cleanSkill) || cleanSkill.includes(sLower);
  });
  if (inMissing) return 'no';

  const candText = (cand.textContent || resumeTextCache[cand.id] || '').toLowerCase();
  if (candText) {
    const words = cleanSkill.split(/\s+/).filter(w => w.length > 3 && !['years', 'experience', 'with', 'knowledge', 'understanding', 'skills', 'ability', 'proficient'].includes(w));
    if (words.length > 0 && words.some(w => candText.includes(w))) {
      return 'yes';
    }
  }

  return isMustHave ? 'no' : 'pending';
}

function generateExecutiveSummary(job, candidates) {
  const analyzed = candidates.filter(c => resumeAnalysisCache[c.id]);
  if (analyzed.length === 0) {
    return "No candidates have been analyzed yet. Scan candidate resumes to generate the talent pool executive summary.";
  }

  let totalScore = 0;
  let topCand = null;
  let topScore = -1;
  const missingCounts = {};

  analyzed.forEach(c => {
    const analysis = resumeAnalysisCache[c.id];
    const score = analysis.matchScore || 0;
    totalScore += score;
    if (score > topScore) {
      topScore = score;
      topCand = c;
    }

    analysis.skills?.missing?.forEach(s => {
      const clean = s.trim();
      missingCounts[clean] = (missingCounts[clean] || 0) + 1;
    });
  });

  const avgScore = Math.round(totalScore / analyzed.length);
  const sortedMissing = Object.entries(missingCounts).sort((a,b) => b[1] - a[1]);
  const mostMissing = sortedMissing.length > 0 ? sortedMissing[0][0] : null;

  let summary = `We have analyzed ${analyzed.length} candidate(s) for the <strong>${escapeHTML(job.roleName)}</strong> position. The average match score is <strong>${avgScore}%</strong>. `;

  if (topCand) {
    summary += `<strong>${escapeHTML(topCand.name)}</strong> is the top-performing candidate with a match score of <strong>${topScore}%</strong>. `;
  }

  if (mostMissing) {
    const pct = Math.round((missingCounts[mostMissing] / analyzed.length) * 100);
    summary += `A significant portion of the candidate pool (${pct}%) lacks experience in <strong>${escapeHTML(mostMissing)}</strong>, which may be a focus area during recruiter screens. `;
  } else {
    summary += `The candidate pool shows strong coverage of all mandatory requirements. `;
  }

  summary += `We recommend proceeding with recruiter screening calls for the top-matched candidates.`;
  return summary;
}

function renderDeepAnalysisPane(job, container) {
  if (!job) return;
  
  if (!job.jdAnalysis) {
    job.jdAnalysis = auditJobDescriptionLocally(job.description || '');
  }
  
  const analysis = job.jdAnalysis;
  const criteria = job.resumeCriteria || { mustHave: [], redFlags: [], goodToHave: [], goodToHaveMinMatch: 1 };
  
  const jobCandidates = filterCandidatesByDateRange(AppState.candidates).filter(c => {
    return c.jobApplied === job.roleName || c.jobApplied === job.cardName;
  });
  
  const gradeThemes = {
    'A': { border: '#10b981', color: '#10b981', bg: 'rgba(16,185,129,0.1)', shadow: 'rgba(16,185,129,0.2)' },
    'A-': { border: '#10b981', color: '#10b981', bg: 'rgba(16,185,129,0.1)', shadow: 'rgba(16,185,129,0.2)' },
    'B+': { border: '#f59e0b', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', shadow: 'rgba(245,158,11,0.2)' },
    'B': { border: '#f59e0b', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', shadow: 'rgba(245,158,11,0.2)' },
    'C+': { border: '#f97316', color: '#f97316', bg: 'rgba(249,115,22,0.1)', shadow: 'rgba(249,115,22,0.2)' },
    'C': { border: '#f97316', color: '#f97316', bg: 'rgba(249,115,22,0.1)', shadow: 'rgba(249,115,22,0.2)' },
    'D': { border: '#ef4444', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', shadow: 'rgba(239,68,68,0.2)' },
    'F': { border: '#ef4444', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', shadow: 'rgba(239,68,68,0.2)' }
  };
  const theme = gradeThemes[analysis.grade] || gradeThemes['A'];

  const leftColHTML = `
    <div class="card-glass jd-analysis-card">
      <div class="jd-analysis-card-header">
        <h3 class="jd-card-title">Job Description Quality Audit</h3>
        <span class="jd-badge-readability">${analysis.readability || 'Clear'} Readability</span>
      </div>
      
      <div class="jd-grade-section" style="border-color: ${theme.border}; background: ${theme.bg}; box-shadow: 0 0 15px ${theme.shadow};">
        <div class="jd-grade-circle" style="color: ${theme.color};">
          ${analysis.grade}
        </div>
        <div class="jd-grade-details">
          <h4>Job Description Score</h4>
          <p>This grade reflects the clarity, expectations, and potential bias of your job description.</p>
        </div>
      </div>
      
      <div class="jd-audit-alerts">
        <h4 class="jd-section-subtitle">Audit Warnings</h4>
        
        <div class="jd-audit-group">
          <h5>Unrealistic Expectations</h5>
          ${(analysis.warnings?.unrealisticExpectations || []).length === 0 ? `
            <div class="jd-audit-item ok">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>No major unrealistic expectations detected.</span>
            </div>
          ` : (analysis.warnings?.unrealisticExpectations || []).map(w => `
            <div class="jd-audit-item warning">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <span>${w}</span>
            </div>
          `).join('')}
        </div>

        <div class="jd-audit-group" style="margin-top: 12px;">
          <h5>Clichés & Corporate Fluff</h5>
          ${(analysis.warnings?.biasFluff || []).length === 0 ? `
            <div class="jd-audit-item ok">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>No corporate fluff clichés detected.</span>
            </div>
          ` : (analysis.warnings?.biasFluff || []).map(w => `
            <div class="jd-audit-item warning">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <span>${w}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="jd-market-context" style="margin-top: 16px;">
        <h4 class="jd-section-subtitle">Market Context</h4>
        <p class="jd-market-text">${analysis.marketContext || 'Standard talent availability for this role.'}</p>
      </div>

      <div class="jd-optimizations" style="margin-top: 16px;">
        <h4 class="jd-section-subtitle">Recommended Optimizations</h4>
        <ul class="jd-opt-list">
          ${(analysis.recommendedOptimizations || []).map(opt => `
            <li>${opt}</li>
          `).join('')}
        </ul>
      </div>

      <div class="jd-audit-actions" style="margin-top: 20px; display: flex; gap: 10px;">
        <button class="btn-enhance-custom btn-jd-optimize-ai" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
          Optimize JD with AI
        </button>
      </div>
    </div>
  `;

  const analyzedCands = jobCandidates.filter(c => resumeAnalysisCache[c.id]);
  const avgMatchScore = analyzedCands.length > 0 
    ? Math.round(analyzedCands.reduce((acc, c) => acc + (resumeAnalysisCache[c.id].matchScore || 0), 0) / analyzedCands.length) 
    : 0;

  const mustHaves = criteria.mustHave || [];
  const goodToHaves = criteria.goodToHave || [];
  
  let matrixHTML = '';
  if (jobCandidates.length === 0) {
    matrixHTML = `
      <div class="jd-empty-pane" style="min-height: 250px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-faint)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>
        <p>No candidates available. Please add candidates to the sourcing panel.</p>
      </div>
    `;
  } else {
    matrixHTML = `
      <div class="table-container-scroller" style="overflow-x: auto; max-width: 100%; border-radius: 8px; border: 1px solid var(--glass-border);">
        <table class="stage-data-table matrix-table" style="min-width: 100%;">
          <thead>
            <tr>
              <th style="position: sticky; left: 0; background: var(--bg-card); z-index: 2;">Candidate</th>
              ${mustHaves.map((s, i) => `<th class="matrix-header-cell must" title="Must-Have: ${escapeHTML(s)}">M${i+1}</th>`).join('')}
              ${goodToHaves.map((s, i) => `<th class="matrix-header-cell good" title="Good-to-Have: ${escapeHTML(s)}">G${i+1}</th>`).join('')}
              <th class="matrix-header-cell" title="Red Flags">Red Flags</th>
              <th class="matrix-header-cell" title="Match Score">Score</th>
            </tr>
          </thead>
          <tbody>
            ${jobCandidates.map(c => {
              const analysis = resumeAnalysisCache[c.id];
              const scoreText = analysis ? `${analysis.matchScore}%` : '—';
              const isAnalyzed = !!analysis;
              const hasRedFlags = analysis && analysis.redFlagsDetected && analysis.redFlagsDetected.length > 0;
              
              const scoreClass = analysis 
                ? (analysis.matchScore >= 70 ? 'score-green' : analysis.matchScore >= 45 ? 'score-yellow' : 'score-red')
                : '';

              return `
                <tr>
                  <td style="position: sticky; left: 0; background: var(--bg-card); z-index: 1; font-weight: 600;">
                    ${escapeHTML(c.name)}
                    ${isAnalyzed ? '' : '<span class="matrix-badge-pending">Pending</span>'}
                  </td>
                  ${mustHaves.map(s => {
                    const status = checkSkillStatus(c, s, true);
                    if (status === 'yes') return '<td class="matrix-cell check" style="color: #10b981; text-align: center;">✓</td>';
                    if (status === 'no') return '<td class="matrix-cell cross" style="color: #ef4444; text-align: center;">✗</td>';
                    return '<td class="matrix-cell dash" style="color: var(--color-text-faint); text-align: center;">—</td>';
                  }).join('')}
                  ${goodToHaves.map(s => {
                    const status = checkSkillStatus(c, s, false);
                    if (status === 'yes') return '<td class="matrix-cell check" style="color: #10b981; text-align: center;">✓</td>';
                    if (status === 'no') return '<td class="matrix-cell cross" style="color: #ef4444; text-align: center;">✗</td>';
                    return '<td class="matrix-cell dash" style="color: var(--color-text-faint); text-align: center;">—</td>';
                  }).join('')}
                  <td style="text-align: center;">
                    ${!isAnalyzed ? '<span style="color: var(--color-text-faint);">—</span>' : (hasRedFlags ? `<span style="color: #ef4444; font-size: 1.1rem;" title="${escapeHTML(analysis.redFlagsDetected.join(', '))}">⚠</span>` : '<span style="color: #10b981;">✓</span>')}
                  </td>
                  <td style="text-align: center; font-weight: 700;">
                    <span class="interview-score-dot ${scoreClass}"></span> ${scoreText}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="matrix-legend" style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--color-text-faint); margin-top: 10px; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <span><strong>M1–M${mustHaves.length}:</strong> Must-Haves (Hover to see full skill)</span>
          <span><strong>G1–G${goodToHaves.length}:</strong> Good-to-Haves</span>
        </div>
        <div style="display: flex; gap: 12px;">
          <span><span style="color: #10b981;">✓</span> Found</span>
          <span><span style="color: #ef4444;">✗</span> Missing</span>
          <span><span style="color: var(--color-text-faint);">—</span> Not analyzed/unknown</span>
        </div>
      </div>
    `;
  }

  const execSummary = generateExecutiveSummary(job, jobCandidates);

  const rightColHTML = `
    <div class="card-glass jd-analysis-card" style="display: flex; flex-direction: column; gap: 20px;">
      <div>
        <div class="jd-analysis-card-header" style="margin-bottom: 8px;">
          <h3 class="jd-card-title">Candidate Sourcing Pool Matrix</h3>
          <span class="jd-badge-readability" style="background: rgba(99,102,241,0.1); color: #818cf8; border-color: rgba(99,102,241,0.2);">Avg Score: ${avgMatchScore}%</span>
        </div>
        <p style="font-size: 0.8rem; color: var(--color-text-faint); margin-bottom: 15px;">Aggregated view of how candidates match specific JD requirements.</p>
        ${matrixHTML}
      </div>

      <div class="jd-analysis-summary-section" style="border-top: 1px solid var(--glass-border); padding-top: 20px;">
        <h4 class="jd-section-subtitle">AI Talent Pool Executive Summary</h4>
        <p class="jd-summary-text" style="font-size: 0.85rem; line-height: 1.5; color: var(--color-text-secondary);">${execSummary}</p>
      </div>
    </div>
  `;

  container.innerHTML = `
    <div class="jd-analysis-grid">
      ${leftColHTML}
      ${rightColHTML}
    </div>
  `;

  const optBtn = container.querySelector('.btn-jd-optimize-ai');
  if (optBtn) {
    optBtn.addEventListener('click', () => {
      optimizeJobDescriptionWithAI(job, container);
    });
  }
}


export { checkSkillStatus, generateExecutiveSummary, renderDeepAnalysisPane };
