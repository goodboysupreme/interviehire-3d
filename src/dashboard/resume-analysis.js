export const resumeTextCache = {};
export const resumeIdentityCache = {};
export const resumeAnalysisCache = {};
export const reportChatCache = {};

export function cacheResumeTextAndIdentity(cid, text, filename = '') {
  if (!text || isGarbageText(text)) return null;

  resumeTextCache[cid] = text;
  const candidate = AppState.candidates.find(c => c.id === cid);
  const identity = extractResumeIdentity(text, candidate?.name || '', filename);
  resumeIdentityCache[cid] = identity;

  if (candidate) {
    if (identity.name && identity.source !== 'filename') candidate.name = identity.name;
    if (identity.email) candidate.email = identity.email;
    if (identity.phone) candidate.phone = identity.phone;
    if (identity.linkedin) candidate.linkedin = identity.linkedin;
    candidate.resumeIdentitySource = identity.source;
    saveStateToLocalStorage();
    refreshResumeCandidateRowIdentity(cid);
  }

  return identity;
}

export function refreshResumeCandidateRowIdentity(cid) {
  const candidate = AppState.candidates.find(c => c.id === cid);
  const row = document.querySelector(`tr[data-cid="${cid}"]`);
  if (!candidate || !row) return;

  const nameEl = row.querySelector('.cand-name-link');
  const emailEl = row.querySelector('.cand-email-sub');
  if (nameEl) nameEl.textContent = candidate.name;
  if (emailEl) emailEl.textContent = candidate.email || 'No email found';
}

export function generateAutoResumeAnalysis(candidateName) {
  // Strictly resume-analysis only — no hallucinated later-stage data
  const matchScore = Math.round(50 + Math.random() * 45);
  return {
    matchScore,
    summary: `${candidateName}'s resume shows relevant experience and skills for the role.`,
    skills: {
      detected: ['Communication', 'Project Management'],
      matched: ['Proposal Writing'],
      missing: []
    },
    recommendation: matchScore >= 70 ? 'Advance' : 'Hold'
  };
}

export function renderResumeStagePaneForJob(candidates, job, container) {
  const getMatchClass = (score) => {
    if (score >= 75) return 'high';
    if (score >= 50) return 'medium';
    if (score > 0) return 'low';
    return 'pending';
  };

  const getRecBadge = (rec) => {
    if (!rec) return '';
    const cls = rec === 'Advance' ? 'high' : rec === 'Hold' ? 'medium' : 'low';
    return `<span class="ra-rec-badge ${cls}">${rec}</span>`;
  };

  const pendingCount = candidates.filter(c => !resumeAnalysisCache[c.id]).length;
  const analysedCount = candidates.length - pendingCount;

  container.innerHTML = `
    <div class="stage-table-container">
      <div class="ra-toolbar">
        <div class="ra-toolbar-left">
          <span class="ra-toolbar-stat">${analysedCount} analysed</span>
          <span class="ra-toolbar-stat pending">${pendingCount} pending</span>
        </div>
        <div class="ra-toolbar-right">
          ${pendingCount > 0 ? `<button class="btn-ra-analyse-all" id="btn-ra-analyse-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Analyse All (${pendingCount})
          </button>` : ''}
        </div>
      </div>
      <div class="ra-table-wrapper">
        <table class="ra-data-table">
          <thead>
            <tr>
              <th style="width:36px;"><input type="checkbox" class="table-checkbox-all" /></th>
              <th>Candidate</th>
              <th>Match</th>
              <th>Recommendation</th>
              <th>Resume Input</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${candidates.map(c => {
              const cached = resumeAnalysisCache[c.id];
              const score = cached ? cached.matchScore : 0;
              const matchClass = getMatchClass(score);
              const isAnalysed = !!cached;
              const hasText = !!resumeTextCache[c.id];
              return `
                <tr data-candidate-id="${c.id}" data-cid="${c.id}" class="${isAnalysed ? 'ra-row-done' : ''}">
                  <td><input type="checkbox" class="table-checkbox-row" /></td>
                  <td>
                    <div class="table-candidate-cell">
                      <span class="cand-name-link">${c.name}</span>
                      <span class="cand-email-sub">${c.email}</span>
                      ${isAnalysed && cached.summary ? `<span class="ra-summary-preview">${cached.summary.slice(0, 90)}${cached.summary.length > 90 ? '…' : ''}</span>` : ''}
                    </div>
                  </td>
                  <td>
                    <span class="ra-match-pill ${matchClass}">${isAnalysed ? score + '%' : '—'}</span>
                  </td>
                  <td>
                    ${isAnalysed ? getRecBadge(cached.recommendation) : '<span class="ra-status-badge pending">Pending</span>'}
                  </td>
                  <td>
                    <div class="ra-input-cell">
                      <input type="file" id="ra-file-${c.id}" accept=".pdf,.doc,.docx,.txt" hidden>
                      ${isAnalysed
                        ? `<button class="btn-ra-view-resume" data-cid="${c.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            View Report
                          </button>`
                        : `<div class="ra-input-group">
                            <button class="btn-ra-upload" data-cid="${c.id}" title="Upload resume file">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                              ${hasText ? 'Replace' : 'Upload'}
                            </button>
                            <span class="ra-file-status ${hasText ? 'has-file' : ''}">${hasText ? 'Text loaded' : 'No file'}</span>
                            <button class="btn-ra-analyse" data-cid="${c.id}" id="ra-btn-${c.id}">
                              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                              Analyse
                            </button>
                          </div>`
                      }
                      ${!isAnalysed ? `<textarea id="ra-paste-${c.id}" class="ra-paste-area" placeholder="Or paste resume text here..." rows="2"></textarea>` : ''}
                    </div>
                  </td>
                  <td>
                    <div class="ra-action-btns">
                      <button class="btn-stage-reject" data-candidate-id="${c.id}">Reject</button>
                      <button class="btn-stage-advance" data-candidate-id="${c.id}" data-next-stage="Screening">Advance</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="stage-table-footer">
        <span class="table-selection-info">${candidates.length} candidate${candidates.length !== 1 ? 's' : ''} in resume analysis</span>
        <div class="table-pagination">
          <span>Page 1 of 1</span>
        </div>
      </div>
    </div>
  `;

  bindResumeAnalysisEvents(job);
}

export function bindResumeAnalysisEvents(job) {
  document.querySelectorAll('.ra-data-table tr[data-cid]').forEach(row => {
    const cid = row.dataset.cid;
    const fileInput = document.getElementById(`ra-file-${cid}`);
    const analyseBtn = row.querySelector('.btn-ra-analyse');
    const viewBtn = row.querySelector('.btn-ra-view-resume');
    const uploadBtn = row.querySelector('.btn-ra-upload');
    const pasteArea = document.getElementById(`ra-paste-${cid}`);

    uploadBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput?.click();
    });

    fileInput?.addEventListener('change', async () => {
      if (fileInput.files[0]) {
        await handleResumeFile(cid, fileInput.files[0]);
        const badge = row.querySelector('.ra-file-status');
        if (badge) {
          badge.textContent = fileInput.files[0].name;
          badge.classList.add('has-file');
        }
      }
    });

    analyseBtn?.addEventListener('click', async () => {
      const hasPaste = pasteArea && pasteArea.value.trim().length > 20;
      const hasFile = resumeTextCache[cid];

      if (!hasPaste && !hasFile) {
        runResumeAnalysis(cid, job);
        return;
      }

      if (pasteArea && pasteArea.value.trim()) {
        const existing = resumeTextCache[cid] || '';
        cacheResumeTextAndIdentity(cid, (existing + '\n' + pasteArea.value.trim()).trim(), 'pasted resume');
      }
      runResumeAnalysis(cid, job);
    });

    viewBtn?.addEventListener('click', () => {
      if (resumeAnalysisCache[cid]) {
        openReportDrawerForCandidate(cid);
      }
    });
  });

  const analyseAllBtn = document.getElementById('btn-ra-analyse-all');
  analyseAllBtn?.addEventListener('click', () => {
    const pendingCids = [];
    document.querySelectorAll('.ra-data-table tr[data-cid]').forEach(row => {
      if (!resumeAnalysisCache[row.dataset.cid]) {
        pendingCids.push(row.dataset.cid);
      }
    });
    if (pendingCids.length === 0) {
      showPremiumToast('All candidates already analysed.', 'info');
      return;
    }
    runBulkResumeAnalysis(pendingCids, job);
  });
}


export function extractNameFromResumeText(text) {
  return extractResumeIdentity(text).name || null;
}
export async function handleResumeFile(cid, file) {
  const isPdfOrDocx = /\.(pdf|docx?)$/i.test(file.name);

  if (isPdfOrDocx) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const resp = await fetch('/api/parse-file', { method: 'POST', body: formData });
      if (!resp.ok) throw new Error('Parse failed');
      const data = await resp.json();
      if (data.text && !isGarbageText(data.text)) {
        const identity = cacheResumeTextAndIdentity(cid, data.text, file.name);
        showPremiumToast(`${file.name} parsed — ${data.text.split('\\n').length} lines extracted.`, 'success');
      } else {
        resumeTextCache[cid] = null;
        showPremiumToast(`${file.name} — could not extract text, will generate profile.`, 'info');
      }
    } catch {
      resumeTextCache[cid] = null;
      showPremiumToast(`Could not parse ${file.name} — will generate candidate profile.`, 'info');
    }
    return;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      if (isGarbageText(text)) {
        resumeTextCache[cid] = null;
        showPremiumToast(`${file.name} loaded — binary content, will generate candidate profile.`, 'info');
      } else {
        cacheResumeTextAndIdentity(cid, text, file.name);
        showPremiumToast(`${file.name} loaded — ${text.split('\\n').length} lines extracted.`, 'success');
      }
      resolve();
    };
    reader.onerror = () => {
      resumeTextCache[cid] = null;
      showPremiumToast(`Could not read ${file.name} — will generate candidate profile.`, 'info');
      resolve();
    };
    reader.readAsText(file);
  });
}

export function generateSyntheticResume(candidate, job) {
  const allSkills = {
    'Full Stack Developer': {
      core: ['JavaScript', 'React', 'Node.js', 'PostgreSQL', 'TypeScript', 'REST APIs', 'Git', 'Docker', 'AWS', 'MongoDB', 'GraphQL', 'Redis', 'Express.js', 'Next.js', 'CI/CD', 'Kubernetes'],
      companies: ['Infosys', 'TCS', 'Wipro', 'Flipkart', 'Razorpay', 'Swiggy', 'Paytm', 'Zoho'],
      tasks: ['Built responsive web dashboards serving 50K+ daily users', 'Implemented RESTful microservices reducing API latency by 40%', 'Led migration from monolith to microservices architecture', 'Designed and maintained CI/CD pipelines with GitHub Actions', 'Optimized database queries resulting in 3x faster page loads', 'Mentored 3 junior developers on React best practices']
    },
    'Government Tender & Proposal Executive': {
      core: ['Proposal Writing', 'RFP Analysis', 'Compliance', 'GeM Portal', 'SAP Ariba', 'Tender Management', 'Government Procurement', 'Documentation', 'MS Office', 'Contract Negotiation', 'Bid Management', 'CPPP Portal', 'Public Procurement', 'Financial Proposals'],
      companies: ['L&T', 'BHEL', 'NTPC', 'Tata Projects', 'Adani Group', 'GMR Group', 'HCL Infra'],
      tasks: ['Managed end-to-end tender lifecycle for 20+ government contracts', 'Drafted technical and financial proposals worth INR 50Cr+', 'Ensured 100% compliance with GeM and CPPP portal requirements', 'Coordinated with legal and finance teams for bid documentation', 'Won 15 government contracts through competitive bidding process', 'Maintained vendor database with 200+ suppliers']
    }
  };
  const profile = allSkills[job.roleName] || allSkills['Full Stack Developer'];
  const shuffled = [...profile.core].sort(() => 0.5 - Math.random());
  const numSkills = 6 + Math.floor(Math.random() * 5);
  const picked = shuffled.slice(0, numSkills);
  const yrs = 1 + Math.floor(Math.random() * 7);
  const company1 = profile.companies[Math.floor(Math.random() * profile.companies.length)];
  const company2 = profile.companies.filter(c => c !== company1)[Math.floor(Math.random() * (profile.companies.length - 1))];
  const tasks = [...profile.tasks].sort(() => 0.5 - Math.random()).slice(0, 3);
  const tasks2 = [...profile.tasks].sort(() => 0.5 - Math.random()).slice(0, 2);

  return `RESUME

Name: ${candidate.name}
Email: ${candidate.email}
Phone: ${candidate.phone}

PROFESSIONAL SUMMARY
Results-driven professional with ${yrs} years of experience in ${job.roleName.toLowerCase()} roles. Strong background in ${picked.slice(0, 3).join(', ')} with a proven ability to deliver high-quality outcomes under deadline pressure.

TECHNICAL SKILLS
${picked.join(' | ')}

WORK EXPERIENCE

${job.roleName} — ${company1} (${Math.max(yrs - 2, 1)} years, current)
${tasks.map(t => '  - ' + t).join('\n')}

Associate ${job.roleName} — ${company2} (2 years)
${tasks2.map(t => '  - ' + t).join('\n')}

EDUCATION
B.Tech in Computer Science — Indian Institute of Technology, Delhi (2018-2022)
CGPA: ${(7 + Math.random() * 2.5).toFixed(1)}/10

CERTIFICATIONS
- AWS Certified Solutions Architect (2024)
- Google Project Management Certificate (2023)`;
}

export function isGarbageText(text) {
  if (!text || text.length < 20) return true;
  const printable = text.replace(/[^\x20-\x7E\n\r\t]/g, '');
  return printable.length / text.length < 0.7;
}

export function extractExperienceYearsFromText(text) {
  const matches = [...String(text || '').matchAll(/(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?experience/gi)];
  if (!matches.length) return 'Not stated';
  const years = Math.max(...matches.map(match => Number(match[1])).filter(Number.isFinite));
  return `${years} year${years === 1 ? '' : 's'}`;
}

export async function runResumeAnalysis(cid, job) {
  const pasteArea = document.getElementById(`ra-paste-${cid}`);
  const btn = document.getElementById(`ra-btn-${cid}`);
  let resumeText = ((resumeTextCache[cid] || '') + '\n' + (pasteArea?.value || '')).trim();
  const candidate = AppState.candidates.find(c => c.id === cid);
  if (!resumeText || isGarbageText(resumeText)) {
    showPremiumToast('Upload a resume or paste resume text first.', 'error');
    return false;
  }

  const origHTML = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="ra-spinner"></span> Analysing…`;
  }

  const criteria = job.resumeCriteria || { mustHave: [], redFlags: [], goodToHave: [] };
  const criteriaBlock = criteria.mustHave.length > 0 ? `
SCREENING CRITERIA:
Must Have: ${criteria.mustHave.join('; ')}
Red Flags (reject if present): ${criteria.redFlags.join('; ')}
Good to Have (bonus): ${criteria.goodToHave.join('; ')}` : '';

  appendTerminalLog(`<code>[${new Date().toLocaleTimeString()}] Aria:</code> Initiated resume analysis for Candidate <strong>${candidate ? candidate.name : cid}</strong>...`);
  appendTerminalLog(`<code>[${new Date().toLocaleTimeString()}] Aria:</code> Extracting skills and matching criteria against job: <strong>${job.roleName}</strong>...`);

  const systemPrompt = `You are Lina, an expert ATS resume analyst for IntervieHire. You perform rigorous, criteria-driven resume screening.

TASK: Analyse the resume against the job requirements and screening criteria. Score honestly — do NOT inflate scores. A candidate missing must-have skills should score below 50.

SCORING RULES:
- matchScore: 0–100 overall fit. Weight must-have criteria at 60%, experience at 20%, good-to-have at 20%.
- scorecard values: 0.0–10.0 each.
- If the resume is clearly auto-generated or lacks real detail, cap matchScore at 40 and note it.
- recommendation: "Advance" if matchScore >= 70, "Hold" if 45-69, "Reject" if < 45.

STRICT SKILL RULES:
- "missing" must ONLY contain skills from the Must Have or Good to Have criteria that the candidate lacks. NEVER invent skills not listed in the job criteria.
- "matched" must ONLY contain skills from the criteria that the candidate demonstrably has.
- "detected" lists other relevant skills found in the resume (keep to top 6).
- Do NOT hallucinate technical skills irrelevant to the role.

Respond ONLY with a valid JSON object — no markdown fences, no extra text:
{
  "matchScore": number,
  "summary": "2-3 sentence assessment with specific evidence from resume",
  "experienceYears": "e.g. 4 years",
  "skills": {
    "detected": ["other relevant skills from resume, max 6"],
    "matched": ["criteria skills the candidate has"],
    "missing": ["criteria skills the candidate lacks — ONLY from Must Have and Good to Have lists"]
  },
  "redFlagsDetected": ["list any red flags from the job criteria list that were found in this resume. Keep empty if none found."],
  "scorecard": {
    "technical": number,
    "experience": number,
    "communication": number,
    "cultureFit": number
  },
  "recommendation": "Advance|Hold|Reject",
  "recommendationReason": "1 sentence with specific reason"
}`;

  const userMsg = `JOB: ${job.cardName} (${job.roleName})
Experience Required: ${job.experienceBand}
Description: ${job.description || '(Not provided)'}${criteriaBlock}

--- CANDIDATE RESUME ---
${resumeText.slice(0, 4000)}`;

  try {
    const raw = await callDeepSeekAPI(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
      true
    );
    const result = JSON.parse(sanitizeJSONResponse(raw));

    // Ensure structure conforms safely to prevent runtime crashes
    if (typeof result.matchScore !== 'number') result.matchScore = parseInt(result.matchScore) || 0;
    if (!result.skills) result.skills = { detected: [], matched: [], missing: [] };
    if (!result.skills.detected) result.skills.detected = [];
    if (!result.skills.matched) result.skills.matched = [];
    if (!result.skills.missing) result.skills.missing = [];
    if (!result.scorecard) result.scorecard = { technical: 5, experience: 5, communication: 5, cultureFit: 5 };
    if (typeof result.scorecard.technical !== 'number') result.scorecard.technical = parseFloat(result.scorecard.technical) || 5;
    if (typeof result.scorecard.experience !== 'number') result.scorecard.experience = parseFloat(result.scorecard.experience) || 5;
    if (typeof result.scorecard.communication !== 'number') result.scorecard.communication = parseFloat(result.scorecard.communication) || 5;
    if (typeof result.scorecard.cultureFit !== 'number') result.scorecard.cultureFit = parseFloat(result.scorecard.cultureFit) || 5;
    if (!result.recommendation) result.recommendation = result.matchScore >= 70 ? 'Advance' : result.matchScore >= 45 ? 'Hold' : 'Reject';
    if (!result.recommendationReason) result.recommendationReason = 'Screened against job requirements.';

    // Post-processing programmatic guardrails for extreme consistency
    if (result.skills && result.skills.missing && criteria.mustHave.length > 0) {
      const missingMustHaves = result.skills.missing.filter(missingSkill => {
        return criteria.mustHave.some(must => {
          const mLower = must.toLowerCase();
          const msLower = missingSkill.toLowerCase();
          return mLower.includes(msLower) || msLower.includes(mLower);
        });
      });
      if (missingMustHaves.length > 0) {
        if (result.matchScore >= 50) {
          result.matchScore = Math.min(48, Math.round(result.matchScore * 0.6));
        }
        result.recommendation = 'Reject';
        result.recommendationReason = `Capped score due to missing Must-Have criteria: ${missingMustHaves.join(', ')}. ` + result.recommendationReason;
      }
    }

    if (result.redFlagsDetected && result.redFlagsDetected.length > 0) {
      result.matchScore = Math.min(30, result.matchScore);
      result.recommendation = 'Reject';
      result.recommendationReason = `Disqualified due to Red Flag detected: ${result.redFlagsDetected.join(', ')}. ` + result.recommendationReason;
    }

    resumeAnalysisCache[cid] = result;
    const cand = AppState.candidates.find(c => c.id === cid);
    if (cand) { cand.score = `${result.matchScore}%`; saveStateToLocalStorage(); }
    renderAnalysisResult(cid, result);
    showPremiumToast('Resume analysis complete.', 'success');

    appendTerminalLog(`<code>[${new Date().toLocaleTimeString()}] Aria:</code> Candidate <strong>${candidate ? candidate.name : cid}</strong> analysis complete. Match Score: <strong style="color: #10b981;">${result.matchScore}%</strong>. Recommendation: <strong>${result.recommendation}</strong>.`, result.recommendation === 'Advance' ? 'font-gold' : '');
    return true;
  } catch (err) {
    console.warn('Real AI analysis failed, falling back to local scanning engine:', err);
    appendTerminalLog(`<code>[${new Date().toLocaleTimeString()}] Aria:</code> <span style="color: #f59e0b;">DeepSeek API offline or unauthorized. Engaging local rule-based parsing engine...</span>`);
    
    try {
      const matched = [];
      const missing = [];
      const detected = [];
      const redFlagsFound = [];

      const commonSkills = ['JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js', 'Python', 'AWS', 'Docker', 'SQL', 'Git', 'HTML', 'CSS', 'Project Management', 'Agile', 'Scrum', 'DevOps', 'CI/CD'];
      commonSkills.forEach(s => {
        if (resumeText.toLowerCase().includes(s.toLowerCase())) {
          detected.push(s);
        }
      });

      criteria.mustHave.forEach(must => {
        const cleanMust = must.replace(/[^\w\s]/g, '').toLowerCase().trim();
        if (resumeText.toLowerCase().includes(cleanMust) || cleanMust.split(/\s+/).filter(w => w.length > 3).every(w => resumeText.toLowerCase().includes(w))) {
          matched.push(must);
        } else {
          missing.push(must);
        }
      });

      criteria.goodToHave.forEach(good => {
        const cleanGood = good.replace(/[^\w\s]/g, '').toLowerCase().trim();
        if (resumeText.toLowerCase().includes(cleanGood) || cleanGood.split(/\s+/).filter(w => w.length > 3).every(w => resumeText.toLowerCase().includes(w))) {
          matched.push(good);
        } else {
          missing.push(good);
        }
      });

      criteria.redFlags.forEach(flag => {
        const cleanFlag = flag.replace(/[^\w\s]/g, '').toLowerCase().trim();
        if (resumeText.toLowerCase().includes(cleanFlag)) {
          redFlagsFound.push(flag);
        }
      });

      const experienceYears = extractExperienceYearsFromText(resumeText);
      let matchScore = 0;
      if (criteria.mustHave.length > 0) {
        const mustHaveRatio = matched.filter(m => criteria.mustHave.includes(m)).length / criteria.mustHave.length;
        matchScore = Math.round(mustHaveRatio * 60);
      } else {
        matchScore += Math.min(40, detected.length * 8);
      }
      if (criteria.goodToHave.length > 0) {
        const goodToHaveRatio = matched.filter(m => criteria.goodToHave.includes(m)).length / criteria.goodToHave.length;
        matchScore += Math.round(goodToHaveRatio * 25);
      } else {
        matchScore += Math.min(20, detected.length * 4);
      }
      matchScore += Math.min(15, (detected.length * 2) + (experienceYears !== 'Not stated' ? 5 : 0));
      matchScore = Math.max(0, Math.min(100, matchScore));

      const technicalScore = matched.length > 0 ? Math.max(4, Math.round((matchScore / 100) * 10)) : (detected.length > 0 ? 5 : 2);
      const experienceScore = experienceYears !== 'Not stated' ? Math.max(4, Math.round((matchScore / 100) * 9)) : 4;
      const communicationScore = /\b(communication|presentation|stakeholder|client|collaboration)\b/i.test(resumeText) ? 6 : 5;
      const cultureFitScore = /\b(team|collaboration|ownership|lead|mentor)\b/i.test(resumeText) ? 6 : 5;
      const summaryEvidence = matched.length > 0
        ? `Matched criteria found: ${matched.slice(0, 3).join(', ')}.`
        : 'No configured criteria were directly matched in the resume text.';

      const localResult = {
        matchScore: matchScore,
        summary: `Local scanning analysis: ${summaryEvidence} ${missing.length > 0 ? `Missing criteria: ${missing.slice(0, 2).join(', ')}.` : 'No configured missing criteria found.'}`,
        experienceYears,
        skills: {
          detected: detected.slice(0, 6),
          matched: matched,
          missing: missing
        },
        redFlagsDetected: redFlagsFound,
        scorecard: {
          technical: Math.min(10, technicalScore),
          experience: Math.min(10, experienceScore),
          communication: Math.min(10, communicationScore),
          cultureFit: Math.min(10, cultureFitScore)
        },
        recommendation: matchScore >= 70 ? 'Advance' : matchScore >= 45 ? 'Hold' : 'Reject',
        recommendationReason: redFlagsFound.length > 0 ? `Rejected due to red flags: ${redFlagsFound.join(', ')}.` : `Score of ${matchScore}% yields ${matchScore >= 70 ? 'Advance' : matchScore >= 45 ? 'Hold' : 'Reject'} recommendation.`
      };

      if (missing.some(m => criteria.mustHave.includes(m))) {
        localResult.matchScore = Math.min(48, Math.round(localResult.matchScore * 0.6));
        localResult.recommendation = 'Reject';
        localResult.recommendationReason = `Capped score due to missing Must-Have criteria: ${missing.filter(m => criteria.mustHave.includes(m)).join(', ')}. ` + localResult.recommendationReason;
      }
      if (redFlagsFound.length > 0) {
        localResult.matchScore = Math.min(30, localResult.matchScore);
        localResult.recommendation = 'Reject';
      }

      resumeAnalysisCache[cid] = localResult;
      const cand = AppState.candidates.find(c => c.id === cid);
      if (cand) { cand.score = `${localResult.matchScore}%`; saveStateToLocalStorage(); }
      renderAnalysisResult(cid, localResult);
      showPremiumToast('Resume analysis complete (Local fallback).', 'info');

      appendTerminalLog(`<code>[${new Date().toLocaleTimeString()}] Aria:</code> Candidate <strong>${candidate ? candidate.name : cid}</strong> analysis complete. Match Score: <strong style="color: #10b981;">${localResult.matchScore}%</strong>. Recommendation: <strong>${localResult.recommendation}</strong>.`, localResult.recommendation === 'Advance' ? 'font-gold' : '');
      return true;
    } catch (fallbackErr) {
      console.error('Fallback failed:', fallbackErr);
      showPremiumToast('Analysis failed — please try again.', 'error');
      appendTerminalLog(`<code>[${new Date().toLocaleTimeString()}] Aria:</code> <span style="color: #f43f5e;">Error during candidate evaluation: ${err.message}.</span>`);
    }
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHTML;
    }
  }
}

export function renderAnalysisResult(cid, result) {
  const row = document.querySelector(`tr[data-cid="${cid}"]`);
  if (!row) return;

  row.classList.add('ra-row-done');
  const tds = row.querySelectorAll('td');

  const matchClass = result.matchScore >= 75 ? 'high' : result.matchScore >= 50 ? 'medium' : 'low';
  if (tds[1]) {
    const cell = tds[1].querySelector('.table-candidate-cell');
    if (cell && result.summary) {
      const existing = cell.querySelector('.ra-summary-preview');
      if (existing) existing.remove();
      const span = document.createElement('span');
      span.className = 'ra-summary-preview';
      span.textContent = result.summary.slice(0, 90) + (result.summary.length > 90 ? '…' : '');
      cell.appendChild(span);
    }
  }
  if (tds[2]) {
    tds[2].innerHTML = `<span class="ra-match-pill ${matchClass}">${result.matchScore}%</span>`;
  }
  if (tds[3]) {
    const recCls = result.recommendation === 'Advance' ? 'high' : result.recommendation === 'Hold' ? 'medium' : 'low';
    tds[3].innerHTML = `<span class="ra-rec-badge ${recCls}">${result.recommendation}</span>`;
  }
  if (tds[4]) {
    tds[4].innerHTML = `<div class="ra-input-cell">
      <button class="btn-ra-view-resume" data-cid="${cid}">
        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        View Report
      </button>
    </div>`;
    tds[4].querySelector('.btn-ra-view-resume')?.addEventListener('click', () => {
      openReportDrawerForCandidate(cid);
    });
  }

  const pendingBtns = document.querySelectorAll('.btn-ra-analyse-all, .ra-toolbar-stat.pending');
  const remaining = document.querySelectorAll('tr[data-cid]:not(.ra-row-done)').length;
  pendingBtns.forEach(el => {
    if (el.classList.contains('ra-toolbar-stat')) {
      el.textContent = `${remaining} pending`;
    } else if (remaining === 0) {
      el.style.display = 'none';
    } else {
      el.innerHTML = el.innerHTML.replace(/\(\d+\)/, `(${remaining})`);
    }
  });
  const analysedStat = document.querySelector('.ra-toolbar-stat:not(.pending)');
  if (analysedStat) {
    const done = document.querySelectorAll('tr.ra-row-done').length;
    analysedStat.textContent = `${done} analysed`;
  }
}

export async function runBulkResumeAnalysis(candidateIds, job) {
  const pending = candidateIds.filter(id => !resumeAnalysisCache[id]);
  if (pending.length === 0) {
    showPremiumToast('All candidates already analysed.', 'info');
    return;
  }
  showPremiumToast(`Analysing ${pending.length} candidate${pending.length > 1 ? 's' : ''}…`, 'info');
  let done = 0;
  for (const cid of pending) {
    try {
      const ok = await runResumeAnalysis(cid, job);
      if (ok === true) done++;
    } catch {
      showPremiumToast(`Failed to analyse candidate ${cid}, continuing…`, 'error');
    }
  }
  showPremiumToast(`Bulk analysis complete: ${done}/${pending.length} succeeded.`, done === pending.length ? 'success' : 'info');
}

export function toggleResumeCriteriaEdit(job) {
  const section = document.querySelector('.ra-config-section');
  if (!section) return;

  const isEditing = section.classList.contains('editing');
  if (isEditing) {
    // Save mode
    section.classList.remove('editing');
    const criteria = { mustHave: [], redFlags: [], goodToHave: [], goodToHaveMinMatch: 1 };
    section.querySelectorAll('.ra-criteria-group.must-have .ra-criteria-edit-input').forEach(input => {
      if (input.value.trim()) criteria.mustHave.push(input.value.trim());
    });
    section.querySelectorAll('.ra-criteria-group.red-flags .ra-criteria-edit-input').forEach(input => {
      if (input.value.trim()) criteria.redFlags.push(input.value.trim());
    });
    section.querySelectorAll('.ra-criteria-group.good-to-have .ra-criteria-edit-input').forEach(input => {
      if (input.value.trim()) criteria.goodToHave.push(input.value.trim());
    });
    const minMatch = section.querySelector('.ra-min-match-input');
    if (minMatch) criteria.goodToHaveMinMatch = parseInt(minMatch.value) || 1;

    job.resumeCriteria = criteria;
    saveStateToLocalStorage();
    showPremiumToast('Resume criteria saved.', 'success');

    // Re-render by triggering the pane render
    const resumeList = document.getElementById('list-stage-resume');
    if (resumeList) {
      const jobCandidates = AppState.candidates.filter(c => {
        const jTitle = c.jobApplied;
        return jTitle === job.roleName || jTitle === job.cardName;
      });
      const resumeCands = jobCandidates.filter(c => c.status === 'Resume');
      // trigger full re-render by calling renderJobDetailPanes
      if (typeof renderJobDetailPanes === 'function') renderJobDetailPanes(job);
    }
    return;
  }

  // Enter edit mode
  section.classList.add('editing');
  const criteria = job.resumeCriteria || { mustHave: [], redFlags: [], goodToHave: [], goodToHaveMinMatch: 1 };

  const editBtn = document.getElementById('btn-ra-edit-criteria');
  if (editBtn) {
    editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Save';
  }

  // Transform criteria items into editable inputs
  section.querySelectorAll('.ra-criteria-items').forEach(itemsContainer => {
    const group = itemsContainer.closest('.ra-criteria-group');
    const groupType = group.classList.contains('must-have') ? 'mustHave' : group.classList.contains('red-flags') ? 'redFlags' : 'goodToHave';
    const items = criteria[groupType] || [];

    itemsContainer.innerHTML = items.map((item, i) => `
      <div class="ra-criteria-item-edit">
        <span class="ra-criteria-num ${group.classList[1]}">${i + 1}</span>
        <input type="text" class="ra-criteria-edit-input" value="${item}" />
        <button class="btn-ra-remove-criteria" data-group="${groupType}" data-idx="${i}">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `).join('') + `
      <button class="btn-ra-add-criteria" data-group="${groupType}">+ Add Criterion</button>
    `;

    // Add button handlers
    itemsContainer.querySelectorAll('.btn-ra-remove-criteria').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.ra-criteria-item-edit').remove();
        // Re-number
        itemsContainer.querySelectorAll('.ra-criteria-num').forEach((num, idx) => {
          num.textContent = idx + 1;
        });
      });
    });

    itemsContainer.querySelector('.btn-ra-add-criteria')?.addEventListener('click', () => {
      const addBtn = itemsContainer.querySelector('.btn-ra-add-criteria');
      const newItem = document.createElement('div');
      newItem.className = 'ra-criteria-item-edit';
      const count = itemsContainer.querySelectorAll('.ra-criteria-item-edit').length + 1;
      newItem.innerHTML = `
        <span class="ra-criteria-num ${group.classList[1]}">${count}</span>
        <input type="text" class="ra-criteria-edit-input" value="" placeholder="Enter criterion..." />
        <button class="btn-ra-remove-criteria">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;
      itemsContainer.insertBefore(newItem, addBtn);
      newItem.querySelector('.btn-ra-remove-criteria').addEventListener('click', () => {
        newItem.remove();
        itemsContainer.querySelectorAll('.ra-criteria-num').forEach((num, idx) => { num.textContent = idx + 1; });
      });
      newItem.querySelector('input').focus();
    });
  });

  // Make min match editable
  const minMatchEl = section.querySelector('.ra-criteria-min-match');
  if (minMatchEl) {
    const currentMin = criteria.goodToHaveMinMatch || 1;
    const totalGood = criteria.goodToHave.length;
    minMatchEl.innerHTML = `Minimum match: <input type="number" class="ra-min-match-input" value="${currentMin}" min="1" max="${totalGood}" style="width:40px;background:rgba(0,0,0,0.2);border:1px solid var(--glass-border);border-radius:4px;color:var(--color-text-primary);text-align:center;padding:2px;font-size:0.78rem;" /> out of ${totalGood} criteria`;
  }
}