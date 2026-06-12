import { document } from './runtime.js';
import { callDeepSeekAPI } from './ai-api.js';
import { updateCandidateStatus } from './job-detail-panes.js';
import { closeDrawers } from './navigation.js';
import { escapeHTML } from './job-flow.js';
import { CandidateReviews, resetWaveformAudio, setupWaveformBars } from './kanban-swarm.js';
import { reportChatCache, resumeAnalysisCache, resumeTextCache } from './resume-analysis.js';
import { soundEngine } from './sound.js';
import { AppState } from './state.js';

function openCandidateReport(candidateId) {
  const candidate = AppState.candidates.find(c => c.id === candidateId);
  if (!candidate) return;
  
  // Set data details
  document.getElementById('report-name').textContent = candidate.name;
  document.getElementById('report-email').textContent = candidate.email;
  document.getElementById('report-job').textContent = candidate.jobApplied;
  document.getElementById('report-score').textContent = candidate.score;
  
  const initials = candidate.name.split(' ').map(n => n[0]).join('');
  document.getElementById('report-avatar').textContent = initials;
  
  // Calculate mock rubrics based on score
  const numericScore = parseFloat(candidate.score);
  const rubrics = {
    coding: (numericScore / 10).toFixed(1),
    sysDesign: ((numericScore - 4 - Math.random() * 4) / 10).toFixed(1),
    comm: ((numericScore + 2 - Math.random() * 4) / 10).toFixed(1),
    probSolving: ((numericScore - 2 - Math.random() * 3) / 10).toFixed(1)
  };
  
  const rubricItems = document.querySelectorAll('#rep-tab-rubric .rubric-item');
  if (rubricItems.length >= 4) {
    rubricItems[0].querySelector('.val').textContent = `${rubrics.coding} / 10`;
    rubricItems[0].querySelector('.bar-inner').style.width = `${rubrics.coding * 10}%`;
    
    rubricItems[1].querySelector('.val').textContent = `${rubrics.sysDesign} / 10`;
    rubricItems[1].querySelector('.bar-inner').style.width = `${rubrics.sysDesign * 10}%`;
    
    rubricItems[2].querySelector('.val').textContent = `${rubrics.comm} / 10`;
    rubricItems[2].querySelector('.bar-inner').style.width = `${rubrics.comm * 10}%`;
    
    rubricItems[3].querySelector('.val').textContent = `${rubrics.probSolving} / 10`;
    rubricItems[3].querySelector('.bar-inner').style.width = `${rubrics.probSolving * 10}%`;
  }
  
  // Load review code dynamically
  const review = CandidateReviews[candidateId] || CandidateReviews['CAN-8234-EA1'];
  const fileContainer = document.querySelector('#rep-tab-code .file-name');
  const codeContainer = document.querySelector('#rep-tab-code .code-view-container code');
  const tagContainer = document.querySelector('#rep-tab-code .author-tag');
  const nameContainer = document.querySelector('#rep-tab-code .author-name');
  const commentContainer = document.querySelector('#rep-tab-code .comment-body');
  
  if (fileContainer) fileContainer.textContent = review.file;
  if (codeContainer) codeContainer.innerHTML = review.code;
  if (tagContainer) tagContainer.textContent = review.initials;
  if (nameContainer) nameContainer.textContent = review.reviewer;
  if (commentContainer) commentContainer.textContent = review.comment;
  
  setupWaveformBars();
  resetWaveformAudio();
  
  // Slide in drawer
  const overlay = document.getElementById('drawer-backdrop');
  overlay.classList.add('active');
  
  const drawerReport = document.getElementById('drawer-report');
  drawerReport.classList.add('active');
  drawerReport.style.right = '0';
  
  soundEngine.playChime([392.00, 523.25, 659.25], 0.15, 0.08);
}

function getCandidateNextStage(status) {
  if (status === 'Resume') return 'Screening';
  if (status === 'Screening') return 'Functional';
  if (status === 'Functional') return 'Hired';
  return null;
}

function getCandidateStageRank(status) {
  const ranks = { Resume: 0, Screening: 1, Functional: 2, Hired: 3 };
  return ranks[status] ?? 0;
}

function getReportStageRows(candidate, aiResult) {
  const rank = getCandidateStageRank(candidate.status);
  return [
    {
      label: 'Resume Analysis',
      state: aiResult ? 'complete' : 'current',
      badge: aiResult ? `${aiResult.matchScore || 0}%` : 'Pending',
      note: aiResult ? (aiResult.recommendationReason || aiResult.summary || 'Resume analysed against the job criteria.') : 'Upload or paste a resume to generate the first evidence-backed decision.'
    },
    {
      label: 'Screening Interview',
      state: rank >= 2 ? 'complete' : rank === 1 ? 'current' : 'locked',
      badge: rank >= 2 ? 'Passed' : rank === 1 ? 'Current' : 'Locked',
      note: rank >= 2 ? 'Candidate has passed screening. No transcript artifact is attached yet.' : rank === 1 ? 'Candidate is in screening. Transcript appears only after real interview data is recorded.' : 'Available after resume screening is passed.'
    },
    {
      label: 'Functional Assessment',
      state: rank >= 3 ? 'complete' : rank === 2 ? 'current' : 'locked',
      badge: rank >= 3 ? 'Passed' : rank === 2 ? 'Current' : 'Locked',
      note: rank >= 3 ? 'Candidate has cleared functional evaluation. Detailed artifact is not attached yet.' : rank === 2 ? 'Candidate is in functional evaluation. Results appear once recorded.' : 'Available after screening is passed.'
    },
    {
      label: 'Hiring Decision',
      state: candidate.status === 'Hired' ? 'complete' : 'locked',
      badge: candidate.status === 'Hired' ? 'Hired' : 'Locked',
      note: candidate.status === 'Hired' ? 'Candidate has been marked as hired.' : 'Available after functional evaluation is passed.'
    }
  ];
}

function renderReportEmptyState(title, copy) {
  return `
    <div class="report-empty-state">
      <span class="report-empty-kicker">No invented data</span>
      <h4>${escapeHTML(title)}</h4>
      <p>${escapeHTML(copy)}</p>
    </div>
  `;
}

function normalizeAnalysisList(items) {
  if (!Array.isArray(items)) return [];
  return items.filter(Boolean).map(item => String(item).trim()).filter(Boolean);
}

function renderReportTagList(label, items, cls = '') {
  const list = normalizeAnalysisList(items);
  if (!list.length) return '';
  return `
    <div class="resume-evidence-card">
      <span class="resume-evidence-label">${escapeHTML(label)}</span>
      <div class="resume-evidence-tags">
        ${list.map(item => `<span class="resume-evidence-tag ${cls}">${escapeHTML(item)}</span>`).join('')}
      </div>
    </div>
  `;
}

function renderStageEvidenceTimeline(candidate, aiResult) {
  return `
    <div class="stage-evidence-timeline">
      ${getReportStageRows(candidate, aiResult).map((stage, index) => `
        <div class="stage-evidence-step ${stage.state}">
          <div class="stage-evidence-index">${index + 1}</div>
          <div class="stage-evidence-copy">
            <div class="stage-evidence-title-row">
              <strong>${escapeHTML(stage.label)}</strong>
              <span class="stage-evidence-badge">${escapeHTML(stage.badge)}</span>
            </div>
            <p>${escapeHTML(stage.note)}</p>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderResumeScorecardRows(aiResult) {
  if (!aiResult || !aiResult.scorecard) return '';
  const rubrics = [
    { label: 'Technical Skills', score: aiResult.scorecard.technical },
    { label: 'Experience', score: aiResult.scorecard.experience },
    { label: 'Communication', score: aiResult.scorecard.communication },
    { label: 'Culture Fit', score: aiResult.scorecard.cultureFit },
  ];
  return `
    <div class="resume-scorecard-panel">
      <span class="section-sub-title">Resume Scorecard</span>
      ${rubrics.map(r => {
        const score = Number.isFinite(Number(r.score)) ? Number(r.score) : 0;
        return `
          <div class="rubric-item">
            <div class="rubric-meta"><span>${escapeHTML(r.label)}</span><strong class="val">${score.toFixed(1)} / 10</strong></div>
            <div class="bar-outer"><div class="bar-inner" style="width: ${Math.max(0, Math.min(100, score * 10))}%;"></div></div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderResumeAnalysisSummary(candidate, aiResult) {
  if (!aiResult) {
    return renderReportEmptyState('Resume analysis pending', 'Only resume analysis results will appear here after a real resume is uploaded or pasted.');
  }
  const recClass = aiResult.recommendation === 'Advance' ? 'high' : aiResult.recommendation === 'Hold' ? 'medium' : 'low';
  return `
    <div class="resume-evidence-hero">
      <div>
        <span class="report-section-kicker">Resume-only result</span>
        <h4>${escapeHTML(candidate.name)} against ${escapeHTML(candidate.jobApplied || 'the selected role')}</h4>
        <p>${escapeHTML(aiResult.summary || 'Resume analysed against the configured job criteria.')}</p>
      </div>
      <div class="resume-evidence-score">
        <strong>${escapeHTML(String(aiResult.matchScore || 0))}%</strong>
        <span class="ra-rec-badge ${recClass}">${escapeHTML(aiResult.recommendation || 'Hold')}</span>
      </div>
    </div>
    <div class="resume-evidence-grid">
      <div class="resume-evidence-card">
        <span class="resume-evidence-label">Decision Reason</span>
        <p>${escapeHTML(aiResult.recommendationReason || 'No decision reason returned.')}</p>
      </div>
      <div class="resume-evidence-card">
        <span class="resume-evidence-label">Experience</span>
        <p>${escapeHTML(aiResult.experienceYears || 'Not stated in resume')}</p>
      </div>
      ${renderReportTagList('Matched Criteria', aiResult.skills?.matched, 'matched')}
      ${renderReportTagList('Missing Criteria', aiResult.skills?.missing, 'missing')}
      ${renderReportTagList('Other Resume Skills', aiResult.skills?.detected, 'detected')}
      ${renderReportTagList('Red Flags Found', aiResult.redFlagsDetected, 'warning')}
    </div>
    ${renderResumeScorecardRows(aiResult)}
  `;
}

function getCandidateTranscriptLines(candidate) {
  const raw = candidate.screeningTranscript || candidate.interviewTranscript || candidate.transcript;
  if (Array.isArray(raw)) return raw.filter(line => line && (line.text || typeof line === 'string'));
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split('\n').map(line => ({ speaker: 'Transcript', text: line.trim() })).filter(line => line.text);
  }
  return [];
}

function renderTranscriptEvidence(candidate) {
  const lines = getCandidateTranscriptLines(candidate);
  if (!lines.length) {
    const copy = candidate.status === 'Resume'
      ? 'This candidate has only resume-stage evidence right now. Screening transcript will appear after interview data is recorded.'
      : 'This candidate has reached a later stage, but no real transcript artifact is attached yet.';
    return renderReportEmptyState('No transcript recorded', copy);
  }
  return lines.map(line => {
    const speaker = typeof line === 'string' ? 'Transcript' : (line.speaker || 'Transcript');
    const text = typeof line === 'string' ? line : line.text;
    return `
      <div class="transcript-chat-line chat-speaker-${escapeHTML(String(speaker).toLowerCase().replace(/[^a-z0-9-]/g, ''))}">
        <span class="chat-speaker-badge">${escapeHTML(speaker)}:</span>
        <span class="chat-text-bubble">${escapeHTML(text)}</span>
      </div>
    `;
  }).join('');
}

function renderReportEvidencePane(candidate, aiResult) {
  if (!aiResult) {
    return renderReportEmptyState('No resume evidence yet', 'Upload or paste a resume first. Later-stage evidence stays hidden until that stage has real recorded data.');
  }
  return `
    ${renderResumeAnalysisSummary(candidate, aiResult)}
    <div class="report-stage-note">
      Screening and functional evidence will be added here only after those stages record real results.
    </div>
  `;
}

function openReportDrawerForCandidate(candidateId) {
  const candidate = AppState.candidates.find(c => c.id === candidateId);
  if (!candidate) return;

  document.getElementById('report-name').textContent = candidate.name;
  document.getElementById('report-email').textContent = candidate.email;
  document.getElementById('report-job').textContent = candidate.jobApplied;
  document.getElementById('report-score').textContent = candidate.score;
  const initials = candidate.name.split(' ').map(n => n[0]).join('');
  document.getElementById('report-avatar').textContent = initials;

  const aiResult = resumeAnalysisCache[candidateId];
  const nextStage = getCandidateNextStage(candidate.status);

  const rubricListEl = document.getElementById('report-rubric-list');
  if (rubricListEl) {
    rubricListEl.innerHTML = `
      ${renderStageEvidenceTimeline(candidate, aiResult)}
      ${renderResumeAnalysisSummary(candidate, aiResult)}
    `;
  }

  const transcriptFlow = document.getElementById('report-transcript-flow');
  if (transcriptFlow) {
    transcriptFlow.innerHTML = renderTranscriptEvidence(candidate);
  }
  const waveformBox = document.querySelector('#rep-tab-transcript .waveform-box');
  if (waveformBox) waveformBox.style.display = getCandidateTranscriptLines(candidate).length ? '' : 'none';

  const caveatsBody = document.getElementById('report-caveats-body');
  if (caveatsBody) {
    caveatsBody.innerHTML = renderReportEvidencePane(candidate, aiResult);
  }

  const actionsBody = document.getElementById('report-action-buttons');
  if (actionsBody) {
    const canAdvance = !!nextStage && (candidate.status !== 'Resume' || !!aiResult);
    actionsBody.innerHTML = `
      ${!aiResult && candidate.status === 'Resume' ? '<div class="report-stage-note">Run resume analysis before moving this candidate to screening.</div>' : ''}
      <div class="jd-card-actions inline">
        ${candidate.status !== 'Hired' && candidate.status !== 'Rejected' ? `<button class="btn-stage-reject" data-candidate-id="${candidateId}">Reject</button>` : ''}
        ${nextStage ? `<button class="btn-stage-advance" data-candidate-id="${candidateId}" data-next-stage="${nextStage}" ${canAdvance ? '' : 'disabled'}>${nextStage === 'Hired' ? 'Mark Hired' : `Advance to ${nextStage}`}</button>` : `<span class="report-terminal-state">${candidate.status === 'Hired' ? 'Candidate hired' : 'No next stage available'}</span>`}
      </div>
    `;
    actionsBody.querySelector('.btn-stage-reject')?.addEventListener('click', () => {
      updateCandidateStatus(candidateId, 'Rejected');
      closeDrawers();
    });
    actionsBody.querySelector('.btn-stage-advance')?.addEventListener('click', () => {
      const next = getCandidateNextStage(candidate.status);
      if (!next) return;
      updateCandidateStatus(candidateId, next);
      closeDrawers();
    });
  }
  setupWaveformBars();
  resetWaveformAudio();

  // --- Semantic Chat Binding for Drawer Report ---
  const chatFeed = document.getElementById('report-chat-feed');
  const chatForm = document.getElementById('report-chat-form');

  if (chatFeed && chatForm) {
    if (!reportChatCache[candidateId]) {
      reportChatCache[candidateId] = [
        { sender: 'aria', text: `Hi! I am Aria, your AI resume analyst. Ask me any questions about **${candidate.name}**'s resume, qualifications, or experience fit.` }
      ];
    }

    const renderChatFeed = () => {
      chatFeed.innerHTML = reportChatCache[candidateId].map(msg => {
        if (msg.sender === 'aria') {
          return `
            <div class="chat-msg system" style="font-size: 0.78rem; color: var(--color-text-primary); background: rgba(99, 102, 241, 0.08); padding: 10px 12px; border-radius: 8px; border: 1px solid rgba(99, 102, 241, 0.2); line-height: 1.4;">
              <strong>Aria:</strong><br>${msg.text}
            </div>
          `;
        } else {
          return `
            <div class="chat-msg user" style="font-size: 0.78rem; color: var(--color-text-primary); background: rgba(255, 255, 255, 0.05); padding: 10px 12px; border-radius: 8px; border: 1px solid var(--glass-border); line-height: 1.4; align-self: flex-end; width: fit-content; max-width: 90%;">
              <strong>You:</strong><br>${msg.text}
            </div>
          `;
        }
      }).join('');
      chatFeed.scrollTop = chatFeed.scrollHeight;
    };

    renderChatFeed();

    // Clean old event listeners (by cloning the form)
    const newChatForm = chatForm.cloneNode(true);
    chatForm.parentNode.replaceChild(newChatForm, chatForm);

    newChatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const questionEl = newChatForm.querySelector('#report-chat-input');
      const question = questionEl ? questionEl.value.trim() : '';
      if (!question) return;

      questionEl.value = '';

      reportChatCache[candidateId].push({ sender: 'user', text: question });
      renderChatFeed();
      soundEngine.playClick();

      // Add typing indicator
      const typingDiv = document.createElement('div');
      typingDiv.className = 'chat-msg system typing-msg';
      typingDiv.style.cssText = 'font-size: 0.78rem; color: var(--color-text-muted); background: rgba(99, 102, 241, 0.04); padding: 10px 12px; border-radius: 8px; border: 1px solid rgba(99, 102, 241, 0.1); line-height: 1.4;';
      typingDiv.innerHTML = `<strong>Aria:</strong><br><span class="ra-spinner" style="display:inline-block; width:10px; height:10px; border: 2px solid var(--color-indigo); border-top-color: transparent; border-radius: 50%; animation: ra-spin 1s linear infinite; margin-right: 6px;"></span> thinking...`;
      chatFeed.appendChild(typingDiv);
      chatFeed.scrollTop = chatFeed.scrollHeight;

      // Get resume text context
      const job = AppState.jobs.find(j => j.roleName === candidate.jobApplied || j.cardName === candidate.jobApplied) || AppState.jobs[0];
      let resumeText = resumeTextCache[candidateId] || '';
      if (!resumeText) {
        resumeText = 'No resume text has been uploaded or pasted for this candidate.';
      }

      const promptMsg = [
        {
          role: 'system',
          content: `You are Aria, the expert AI resume analyst on the IntervieHire platform swarm.
You are chatting with a recruiter about a candidate.
Answer the recruiter's questions directly, accurately and concisely based ONLY on the candidate's resume and details below.
If the information is not in the resume, explicitly say so — do not invent or assume.

JOB REQUIREMENT:
Role: ${job.roleName}
Description: ${job.description}

CANDIDATE:
Name: ${candidate.name}
Email: ${candidate.email}

RESUME CONTENT:
${resumeText.slice(0, 4000)}`
        },
        {
          role: 'user',
          content: question
        }
      ];

      try {
        const answer = await callDeepSeekAPI(promptMsg, false);
        const typ = chatFeed.querySelector('.typing-msg');
        if (typ) typ.remove();

        reportChatCache[candidateId].push({ sender: 'aria', text: answer });
        renderChatFeed();
        soundEngine.playChime([440, 554, 659], 0.12, 0.08);
      } catch (err) {
        const typ = chatFeed.querySelector('.typing-msg');
        if (typ) typ.remove();
        reportChatCache[candidateId].push({ sender: 'aria', text: 'Sorry, I encountered an error while analyzing the resume. Please check your API configuration.' });
        renderChatFeed();
      }
    });
  }

  const overlay = document.getElementById('drawer-backdrop');
  overlay.classList.add('active');
  const drawerReport = document.getElementById('drawer-report');
  drawerReport.classList.add('active');
  drawerReport.style.right = '0';

  const tabs = drawerReport.querySelectorAll('.report-tab-btn');
  const contents = drawerReport.querySelectorAll('.report-tab-content');
  tabs.forEach(t => {
    t.addEventListener('click', () => {
      tabs.forEach(tb => tb.classList.remove('active'));
      contents.forEach(ct => ct.classList.remove('active'));
      t.classList.add('active');
      const tabName = t.getAttribute('data-report-tab');
      const target = document.getElementById(`rep-tab-${tabName}`);
      if (target) target.classList.add('active');
    });
  });

  soundEngine.playChime([392.00, 523.25, 659.25], 0.15, 0.08);
}


export { getCandidateNextStage, getCandidateStageRank, getCandidateTranscriptLines, getReportStageRows, normalizeAnalysisList, openCandidateReport, openReportDrawerForCandidate, renderReportEmptyState, renderReportEvidencePane, renderReportTagList, renderResumeAnalysisSummary, renderResumeScorecardRows, renderStageEvidenceTimeline, renderTranscriptEvidence };
