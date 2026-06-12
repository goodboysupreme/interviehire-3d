import { document } from './runtime.js';
import { callDeepSeekAPI, sanitizeJSONResponse, saveStateToLocalStorage } from './ai-api.js';
import { soundEngine } from './sound.js';
import { showPremiumToast } from './sourcing.js';

const questionStaging = { list: [] };

function generateQuestionsLocally(job) {
  const role = (job.roleName || job.cardName || 'Professional').toLowerCase();
  
  let questions = [];
  if (role.includes('developer') || role.includes('engineer') || role.includes('programmer') || role.includes('software')) {
    questions = [
      {
        id: "q-gen-1",
        type: "technical",
        question: "Explain the architectural considerations when building scalable web applications. How do you handle performance bottlenecks, caching, and database optimizations?",
        difficulty: "intermediate",
        rubric: "Candidate should explain caching strategies (Redis, CDN), database indexes/queries tuning, and horizontal vs. vertical scaling.",
        follow_ups: ["Can you share a real-world project where you resolved a bottleneck?", "How do you decide between SQL and NoSQL databases?"]
      },
      {
        id: "q-gen-2",
        type: "technical",
        question: "How do you ensure code quality, test coverage, and smooth CI/CD deployments in your team? What tools and practices do you advocate for?",
        difficulty: "intermediate",
        rubric: "Look for familiarity with Jest/Playwright, GitHub Actions/Jenkins, branch staging, linting, and peer reviews.",
        follow_ups: ["What is your strategy for testing async code or APIs?", "How do you handle rollbacks if a production deploy fails?"]
      },
      {
        id: "q-gen-3",
        type: "behavioral",
        question: "Describe a situation where you had a strong technical disagreement with a team lead or colleague. How did you present your arguments, and what was the outcome?",
        difficulty: "intermediate",
        rubric: "Candidate should demonstrate professional communication, active listening, reliance on data/evidence, and dedication to team alignment.",
        follow_ups: ["How did you handle the personal relationship afterward?", "What did you learn from that conflict?"]
      },
      {
        id: "q-gen-4",
        type: "behavioral",
        question: "Tell me about a time when you were assigned a task using a technology or domain you had zero prior experience with. How did you navigate the learning curve?",
        difficulty: "beginner",
        rubric: "Candidate should detail proactive research, asking questions, building small spikes/POCs, and managing deadlines under uncertainty.",
        follow_ups: ["How long did it take you to feel productive?", "Who did you look to for help or documentation?"]
      },
      {
        id: "q-gen-5",
        type: "situational",
        question: "Imagine our production application goes offline during a major product launch, and the team is under high pressure. Walk me through your immediate steps to diagnose and mitigate the issue.",
        difficulty: "advanced",
        rubric: "Candidate must emphasize safety first: checking logs (Sentry/Datadog), rolling back recent commits, transparent communication with stakeholders, and structured root-cause analysis.",
        follow_ups: ["How do you keep the rest of the team informed during the outage?", "What measures do you put in place to prevent a recurrence?"]
      }
    ];
  } else if (role.includes('manager') || role.includes('lead') || role.includes('product') || role.includes('director')) {
    questions = [
      {
        id: "q-gen-1",
        type: "technical",
        question: "How do you translate business objectives and customer feedback into a structured product roadmap? How do you prioritize feature requests?",
        difficulty: "intermediate",
        rubric: "Look for prioritization frameworks like RICE, Kano, or MoSCoW, data-driven decisions, and balancing stakeholder demands.",
        follow_ups: ["How do you handle a request that is high-priority for a client but low-value for the roadmap?", "How do you measure product-market fit?"]
      },
      {
        id: "q-gen-2",
        type: "technical",
        question: "Describe your approach to metric tracking and product analytics. What KPIs do you look at daily, and how do you use them to drive growth?",
        difficulty: "intermediate",
        rubric: "Candidate should mention DAU/MAU, conversion funnels, churn rate, NPS, and using tools like Amplitude, Mixpanel, or SQL.",
        follow_ups: ["How do you run and evaluate A/B test experiments?", "What is a leading indicator of churn in your experience?"]
      },
      {
        id: "q-gen-3",
        type: "behavioral",
        question: "Tell me about a time when you had to make a high-stakes decision without complete data. What was the situation, what did you decide, and what was the outcome?",
        difficulty: "intermediate",
        rubric: "Demonstrates ability to manage ambiguity, weigh risks, rely on qualitative signals, and take accountability for outcomes.",
        follow_ups: ["Would you make the same decision today?", "How did you communicate the risk to your leadership?"]
      },
      {
        id: "q-gen-4",
        type: "behavioral",
        question: "Describe a project that failed or missed its deadlines under your leadership. How did you manage expectations, and what retrospective actions did you take?",
        difficulty: "beginner",
        rubric: "Shows humility, transparency in reporting blockers, focus on learning, and implementing process guardrails in subsequent sprints.",
        follow_ups: ["How did the team react to the failure?", "What was the feedback from your client/stakeholder?"]
      },
      {
        id: "q-gen-5",
        type: "situational",
        question: "A key engineering lead states that a feature promised to marketing cannot be completed in time unless code quality is severely compromised. How do you handle this conflict?",
        difficulty: "advanced",
        rubric: "Balances technical debt and business deadlines. Prefers scoping down features, negotiation, clear alignment on technical trade-offs, and protecting team health.",
        follow_ups: ["How do you explain the delay to the marketing team?", "What is your strategy for paying back the tech debt later?"]
      }
    ];
  } else {
    questions = [
      {
        id: "q-gen-1",
        type: "technical",
        question: "What is your methodology for managing projects and deadlines? How do you ensure high-quality delivery when handling multiple competing priorities?",
        difficulty: "intermediate",
        rubric: "Candidate should mention prioritization (Eisenhower matrix), calendar blocks, task managers, status updates, and setting clear boundaries.",
        follow_ups: ["How do you handle sudden shifts in project goals?", "What tools do you find most effective for collaboration?"]
      },
      {
        id: "q-gen-2",
        type: "technical",
        question: "Describe your communication strategy when coordinating across different teams (e.g. Sales, Operations, Product). How do you align conflicting goals?",
        difficulty: "intermediate",
        rubric: "Look for stakeholder analysis, documentation (RFCs, minutes), regular syncs, empathy, and active listening.",
        follow_ups: ["What is your preferred format for weekly status updates?", "How do you handle a team that is slow to respond?"]
      },
      {
        id: "q-gen-3",
        type: "behavioral",
        question: "Tell me about a time when you received tough feedback from a supervisor or client. How did you process it, and what actions did you take to improve?",
        difficulty: "intermediate",
        rubric: "Shows growth mindset, emotional maturity, taking notes, creating an action plan, and seeking follow-up reviews.",
        follow_ups: ["How did your relationship with the feedback provider change?", "Can you give an example of a mistake you have corrected since then?"]
      },
      {
        id: "q-gen-4",
        type: "behavioral",
        question: "Describe a successful project you led or contributed to significantly. What was your role, and what specific impact did you deliver?",
        difficulty: "beginner",
        rubric: "Clear focus on contribution, collaboration, quantifying results (e.g. time saved, revenue increased, error rates reduced).",
        follow_ups: ["What part of the success are you most proud of?", "How did you celebrate the achievement with your team?"]
      },
      {
        id: "q-gen-5",
        type: "situational",
        question: "You realize that a teammate has made a critical error in a report already submitted to a client, but they are defensive about it. How do you handle this?",
        difficulty: "advanced",
        rubric: "Prioritizes correcting the error for the client first. Communicates privately, presents factual evidence objectively without blame, and collaborates on the fix.",
        follow_ups: ["How do you ensure the client's trust is maintained?", "How do you build a safer, blame-free culture in the team?"]
      }
    ];
  }
  return questions;
}

// Render the Questions Pane for a specific job
function renderQuestionsPane(job) {
  const listQuestions = document.getElementById('list-questions');
  if (!listQuestions) return;

  const rawDesc = document.getElementById('jd-raw-description');
  if (rawDesc) {
    rawDesc.value = job.description || "";
  }

  const countBadge = document.getElementById('questions-count-badge');
  const questionsCount = job.questions ? job.questions.length : 0;
  if (countBadge) {
    countBadge.textContent = `${questionsCount} question${questionsCount !== 1 ? 's' : ''}`;
  }

  if (rawDesc && !rawDesc.dataset.boundChange) {
    rawDesc.dataset.boundChange = "true";
    rawDesc.addEventListener('input', () => {
      job.description = rawDesc.value.trim();
      saveStateToLocalStorage();
    });
  }

  if (!job.questions || job.questions.length === 0) {
    listQuestions.innerHTML = `
      <div class="qg-empty">
        <div class="qg-empty-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </div>
        <p class="qg-empty-title">No rubric questions yet</p>
        <p class="qg-empty-desc">Add a job description in the left panel, tune generation settings, then run Generate questions to draft your interview set.</p>
      </div>
    `;
  } else {
    listQuestions.innerHTML = job.questions.map((q, qIndex) => {
      const typeColors = {
        technical: { bg: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.2)', text: '#38bdf8' },
        behavioral: { bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.2)', text: '#a855f7' },
        situational: { bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)', text: '#34d399' }
      };
      const tc = typeColors[q.type] || typeColors.technical;
      const diffColors = {
        beginner: { bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)', text: '#34d399' },
        intermediate: { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)', text: '#fbbf24' },
        advanced: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', text: '#ef4444' }
      };
      const dc = diffColors[q.difficulty] || diffColors.intermediate;

      const isCollapsed = q.collapsed === true;
      const questionPreview = (q.question || '').length > 120 ? (q.question || '').slice(0, 120) + '…' : (q.question || '');
      const fuCount = q.follow_ups ? q.follow_ups.length : 0;
      const hasRubric = !!(q.rubric && q.rubric.trim());
      const metaHints = [hasRubric ? 'Rubric' : null, fuCount > 0 ? `${fuCount} Follow-up${fuCount > 1 ? 's' : ''}` : null].filter(Boolean).join(' · ');
      return `
      <div class="card-glass jd-question-card ${isCollapsed ? 'collapsed' : ''}" data-q-id="${q.id}" data-idx="${qIndex}">

        <!-- Collapsed: compact summary row -->
        <div class="q-collapsed-row" data-idx="${qIndex}">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="q-collapse-chevron"><polyline points="6 9 12 15 18 9"></polyline></svg>
          <span class="q-number">Q${qIndex + 1}</span>
          <span class="q-collapsed-text">${questionPreview || 'Untitled question'}</span>
          ${metaHints ? `<span class="q-collapsed-meta">${metaHints}</span>` : ''}
          <div class="q-badges">
            <span class="q-badge-pill" style="background:${tc.bg};border-color:${tc.border};color:${tc.text};">${(q.type || 'technical').charAt(0).toUpperCase() + (q.type || 'technical').slice(1)}</span>
            <span class="q-badge-pill" style="background:${dc.bg};border-color:${dc.border};color:${dc.text};">${(q.difficulty || 'intermediate').charAt(0).toUpperCase() + (q.difficulty || 'intermediate').slice(1)}</span>
          </div>
        </div>

        <!-- Expanded: full editable card -->
        <div class="q-expanded-content">
          <div class="q-card-top-row">
            <div style="display:flex; align-items:center; gap:6px;">
              <button type="button" class="btn-q-collapse-toggle" data-idx="${qIndex}" title="Collapse Details" style="background:none; border:none; padding:2px; color:var(--color-text-faint); cursor:pointer; display:flex; align-items:center; justify-content:center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
              <span class="q-number">Q${qIndex + 1}</span>
            </div>
            <div class="q-badges">
              <select class="q-type-select q-badge-select" data-field="type" style="background:${tc.bg};border-color:${tc.border};color:${tc.text};">
                <option value="technical" ${(q.type || 'technical') === 'technical' ? 'selected' : ''}>Technical</option>
                <option value="behavioral" ${q.type === 'behavioral' ? 'selected' : ''}>Behavioral</option>
                <option value="situational" ${q.type === 'situational' ? 'selected' : ''}>Situational</option>
              </select>
              <select class="q-difficulty-select q-badge-select" data-field="difficulty" style="background:${dc.bg};border-color:${dc.border};color:${dc.text};">
                <option value="beginner" ${q.difficulty === 'beginner' ? 'selected' : ''}>Beginner</option>
                <option value="intermediate" ${q.difficulty === 'intermediate' ? 'selected' : ''}>Intermediate</option>
                <option value="advanced" ${q.difficulty === 'advanced' ? 'selected' : ''}>Advanced</option>
              </select>
            </div>
          </div>

          <div class="q-card-body">
            <textarea class="q-question-text" data-field="question" placeholder="Enter question wording..." rows="2"></textarea>

            <div class="q-rubric-section">
              <div class="q-rubric-header">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                <span>Evaluation Rubric</span>
              </div>
              <textarea class="q-rubric-text" data-field="rubric" placeholder="What does a good answer look like?..." rows="2"></textarea>
            </div>

            <div class="q-followups-section">
              <div class="q-followups-header">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                <span>Follow-ups</span>
                <span class="q-followup-count">${fuCount}</span>
              </div>
              <ul class="q-followups-list">
                ${(q.follow_ups || []).map((f, idx) => `
                  <li class="q-followup-item">
                    <span class="q-followup-num">${idx + 1}</span>
                    <input type="text" class="q-followup-input" data-idx="${idx}" value="${f}" />
                    <button class="btn-q-remove-followup" data-idx="${idx}" data-q-idx="${qIndex}" title="Remove">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </li>
                `).join('')}
              </ul>
              <button class="btn-q-add-followup" data-q-idx="${qIndex}">+ Add Follow-up</button>
            </div>
          </div>

          <div class="q-card-footer">
            <div class="q-card-footer-right">
              <button class="btn-q-delete btn-jd-ghost btn-sm" data-idx="${qIndex}" title="Delete">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Delete
              </button>
              <button class="btn-q-enhance btn-jd-primary btn-sm" data-idx="${qIndex}" title="Enhance with AI">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Enhance
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    }).join('');

    job.questions.forEach((q, idx) => {
      const card = listQuestions.children[idx];
      if (card) {
        const textareaQ = card.querySelector('.q-question-text');
        if (textareaQ) textareaQ.value = q.question;
        
        const textareaR = card.querySelector('.q-rubric-text');
        if (textareaR) textareaR.value = q.rubric || '';
      }
    });

    listQuestions.querySelectorAll('.btn-q-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'));
        job.questions.splice(idx, 1);
        saveStateToLocalStorage();
        renderQuestionsPane(job);
        showPremiumToast("Question deleted.", "success");
        soundEngine.playClick();
      });
    });

    // AUTO-SAVE (default live mode for entire QG tab): type, text, rubric, follow-ups update instantly on change/blur
    listQuestions.querySelectorAll('.q-type-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        const card = sel.closest('.jd-question-card');
        const idx = parseInt(card.dataset.idx);
        if (isNaN(idx) || !job.questions[idx]) return;
        const q = job.questions[idx];
        const newType = sel.value;
        q.type = newType;
        saveStateToLocalStorage();

        // instant restyle this badge for the new type (no re-render, keeps focus)
        const typeColors = {
          technical: { bg: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.2)', text: '#38bdf8' },
          behavioral: { bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.2)', text: '#a855f7' },
          situational: { bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)', text: '#34d399' }
        };
        const tc = typeColors[newType] || typeColors.technical;
        sel.style.background = tc.bg;
        sel.style.borderColor = tc.border;
        sel.style.color = tc.text;

        const textareaQ = card.querySelector('.q-question-text');
        const origText = textareaQ.value;
        textareaQ.value = 'Regenerating for ' + newType + ' type...';
        textareaQ.disabled = true;
        sel.disabled = true;

        try {
          const prompt = `You are an expert interview question designer.\nRewrite this interview question to be a ${newType} question. Keep the same topic and difficulty (${q.difficulty}).\nReturn ONLY valid JSON: {"question":"...","rubric":"...","follow_ups":["...","..."]}`;
          const resp = await callDeepSeekAPI([
            { role: 'system', content: prompt },
            { role: 'user', content: origText }
          ], true);
          const parsed = JSON.parse(sanitizeJSONResponse(resp));
          q.question = parsed.question || origText;
          q.rubric = parsed.rubric || q.rubric;
          q.follow_ups = parsed.follow_ups || q.follow_ups;
          saveStateToLocalStorage();
          renderQuestionsPane(job);
          showPremiumToast(`Question regenerated as ${newType} type.`, 'success');
        } catch (err) {
          textareaQ.value = origText;
          textareaQ.disabled = false;
          sel.disabled = false;
          showPremiumToast('Failed to regenerate. Type saved.', 'error');
          saveStateToLocalStorage();
        }
      });
    });

    // note: difficulty select listener below already does live update + AI regen

    // live persist for question + rubric text (on blur to avoid spam during typing)
    listQuestions.querySelectorAll('.q-question-text').forEach(ta => {
      ta.addEventListener('blur', () => {
        const card = ta.closest('.jd-question-card');
        const idx = parseInt(card.dataset.idx);
        if (isNaN(idx) || !job.questions[idx]) return;
        job.questions[idx].question = ta.value.trim();
        saveStateToLocalStorage();
        // no toast, silent auto
      });
    });
    listQuestions.querySelectorAll('.q-rubric-text').forEach(ta => {
      ta.addEventListener('blur', () => {
        const card = ta.closest('.jd-question-card');
        const idx = parseInt(card.dataset.idx);
        if (isNaN(idx) || !job.questions[idx]) return;
        job.questions[idx].rubric = ta.value.trim();
        saveStateToLocalStorage();
      });
    });

    // live persist follow-up edits on blur
    listQuestions.querySelectorAll('.q-followup-input').forEach(inp => {
      inp.addEventListener('blur', () => {
        const card = inp.closest('.jd-question-card');
        const qIdx = parseInt(card.dataset.idx);
        if (isNaN(qIdx) || !job.questions[qIdx]) return;
        const all = [];
        card.querySelectorAll('.q-followup-input').forEach(i => { if (i.value.trim()) all.push(i.value.trim()); });
        job.questions[qIdx].follow_ups = all;
        saveStateToLocalStorage();
      });
    });

    listQuestions.querySelectorAll('.btn-q-enhance').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'));
        const q = job.questions[idx];
        
        openEnhanceModal(q.question, (enhancedData) => {
          job.questions[idx].question = enhancedData.question;
          job.questions[idx].rubric = enhancedData.rubric;
          job.questions[idx].follow_ups = enhancedData.follow_ups;
          saveStateToLocalStorage();
          renderQuestionsPane(job);
          showPremiumToast("Question enhanced successfully.", "success");
        });
      });
    });

    listQuestions.querySelectorAll('.q-difficulty-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        const card = sel.closest('.jd-question-card');
        const idx = parseInt(card.dataset.idx);
        if (isNaN(idx) || !job.questions[idx]) return;
        const q = job.questions[idx];
        const newDiff = sel.value;
        q.difficulty = newDiff;
        const textareaQ = card.querySelector('.q-question-text');
        const origText = textareaQ.value;
        textareaQ.value = 'Regenerating for ' + newDiff + ' difficulty...';
        textareaQ.disabled = true;
        sel.disabled = true;
        try {
          const prompt = `You are an expert interview question designer.\nRewrite this interview question at ${newDiff} difficulty level. Keep the same topic and type (${q.type}).\nReturn ONLY valid JSON: {"question":"...","rubric":"...","follow_ups":["...","..."]}`;
          const resp = await callDeepSeekAPI([
            { role: 'system', content: prompt },
            { role: 'user', content: origText }
          ], true);
          const parsed = JSON.parse(sanitizeJSONResponse(resp));
          q.question = parsed.question || origText;
          q.rubric = parsed.rubric || q.rubric;
          q.follow_ups = parsed.follow_ups || q.follow_ups;
          saveStateToLocalStorage();
          renderQuestionsPane(job);
          showPremiumToast(`Question regenerated at ${newDiff} difficulty.`, 'success');
        } catch (err) {
          textareaQ.value = origText;
          textareaQ.disabled = false;
          sel.disabled = false;
          showPremiumToast('Failed to regenerate. Difficulty saved.', 'error');
          saveStateToLocalStorage();
        }
      });
    });

    listQuestions.querySelectorAll('.btn-q-collapse-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'));
        if (isNaN(idx) || !job.questions[idx]) return;
        job.questions[idx].collapsed = true;
        saveStateToLocalStorage();
        renderQuestionsPane(job);
        soundEngine.playClick();
      });
    });

    listQuestions.querySelectorAll('.q-collapsed-row').forEach(row => {
      row.addEventListener('click', () => {
        const idx = parseInt(row.getAttribute('data-idx'));
        if (isNaN(idx) || !job.questions[idx]) return;
        job.questions[idx].collapsed = false;
        saveStateToLocalStorage();
        renderQuestionsPane(job);
        soundEngine.playClick();
      });
    });

    listQuestions.querySelectorAll('.btn-q-add-followup').forEach(btn => {
      btn.addEventListener('click', () => {
        const qIdx = parseInt(btn.getAttribute('data-q-idx'));
        if (!job.questions[qIdx].follow_ups) job.questions[qIdx].follow_ups = [];
        job.questions[qIdx].follow_ups.push('');
        saveStateToLocalStorage();
        renderQuestionsPane(job);
      });
    });

    listQuestions.querySelectorAll('.btn-q-remove-followup').forEach(btn => {
      btn.addEventListener('click', () => {
        const qIdx = parseInt(btn.getAttribute('data-q-idx'));
        const fIdx = parseInt(btn.getAttribute('data-idx'));
        if (job.questions[qIdx].follow_ups) {
          job.questions[qIdx].follow_ups.splice(fIdx, 1);
          saveStateToLocalStorage();
          renderQuestionsPane(job);
        }
      });
    });
  }

  const btnGen = document.getElementById('btn-generate-questions');
  if (btnGen) {
    const newBtnGen = btnGen.cloneNode(true);
    btnGen.parentNode.replaceChild(newBtnGen, btnGen);
    
    newBtnGen.addEventListener('click', async () => {
      const desc = rawDesc ? rawDesc.value.trim() : "";
      if (!desc) {
        showPremiumToast("Please enter a job description to generate questions.", "error");
        return;
      }

      newBtnGen.disabled = true;
      newBtnGen.classList.add('generating');
      const textSpan = newBtnGen.querySelector('.btn-text');
      const loaderSpan = document.createElement('span');
      loaderSpan.innerHTML = `<div class="spinner-mini" style="display:inline-block; width:12px; height:12px; border:2px solid rgba(255,255,255,0.3); border-top-color:#ffffff; border-radius:50%; animation:spin-mini 0.6s linear infinite; margin-right:6px; vertical-align:middle;"></div> Generating...`;

      const originalText = textSpan.textContent;
      textSpan.style.display = 'none';
      newBtnGen.appendChild(loaderSpan);
      
      soundEngine.playChime([392, 440], 0.1, 0.1);

      const numQ = document.getElementById('cfg-num-questions')?.value || '5';
      const qTypes = document.getElementById('cfg-question-types')?.value || 'mixed';
      const qDiff = document.getElementById('cfg-difficulty')?.value || 'mixed';
      const qDuration = document.getElementById('cfg-duration')?.value || '30';
      const qFollowups = document.getElementById('cfg-followups')?.value || '2';

      const typeInstruction = qTypes === 'mixed'
        ? 'Include a mix of technical, behavioral, and situational questions.'
        : `Generate only ${qTypes} questions.`;
      const diffInstruction = qDiff === 'mixed'
        ? 'Include a mix of beginner, intermediate, and advanced difficulty levels.'
        : `All questions should be ${qDiff} difficulty.`;

      const systemPrompt = `You are a senior hiring manager and domain expert.
Generate exactly ${numQ} high-quality interview questions based on the given job description.
The interview is planned for ${qDuration} minutes.

${typeInstruction}
${diffInstruction}

Return ONLY a JSON object in this exact format (no markdown, no explanation, no extra text):
{"questions":[{"type":"technical","question":"Your question here?","difficulty":"intermediate","rubric":"What a good answer includes.","follow_ups":["Follow-up 1","Follow-up 2"]}]}

Rules:
- "type" must be one of: "technical", "behavioral", "situational"
- "difficulty" must be one of: "beginner", "intermediate", "advanced"
- "rubric" should describe what a strong candidate answer covers
- "follow_ups" must contain exactly ${qFollowups} follow-up question strings
- Generate exactly ${numQ} question objects in the array`;

      try {
        const responseText = await callDeepSeekAPI([
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate ${numQ} interview questions for this job description:\n\n${desc}` }
        ], true);

        const cleanText = sanitizeJSONResponse(responseText);
        const parsed = JSON.parse(cleanText);

        const questionsArr = parsed.questions || parsed.interview_questions || (Array.isArray(parsed) ? parsed : null);
        if (questionsArr && questionsArr.length > 0) {
          questionStaging.list = questionsArr.map((q, idx) => ({
            id: `q-gen-${Date.now()}-${idx}`,
            type: q.type || q.category || 'technical',
            question: q.question || q.text || '',
            difficulty: q.difficulty || q.level || 'intermediate',
            rubric: q.rubric || q.evaluation_rubric || q.expected_answer || '',
            follow_ups: q.follow_ups || q.followups || q.follow_up_questions || []
          }));

          showStagingArea(job);
        } else {
          throw new Error("Invalid response format. Could not find questions array.");
        }
      } catch (err) {
        console.error("Failed to generate questions:", err);
        const errMsg = err.message || 'Unknown error';
        if (errMsg.includes('API response error')) {
          showPremiumToast(`API error: ${errMsg}`, "error");
        } else if (errMsg.includes('aborted')) {
          showPremiumToast("Request timed out. The API took too long to respond.", "error");
        } else {
          showPremiumToast(`Failed to generate questions: ${errMsg}`, "error");
        }
      } finally {
        newBtnGen.disabled = false;
        newBtnGen.classList.remove('generating');
        loaderSpan.remove();
        textSpan.style.display = 'inline-block';
      }
    });
  }

  const btnToggleJd = document.getElementById('btn-toggle-jd');
  const jdDetails = document.getElementById('qg-jd-details');
  if (btnToggleJd && jdDetails) {
    btnToggleJd.addEventListener('click', () => {
      jdDetails.classList.toggle('open');
      const expanded = jdDetails.classList.contains('open');
      btnToggleJd.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      soundEngine.playClick();
    });
  }

  const btnAddRaw = document.getElementById('btn-add-question-raw');
  const btnEnhanceCustom = document.getElementById('btn-enhance-custom');
  const inputCustom = document.getElementById('input-custom-question');
  
  if (btnAddRaw && btnEnhanceCustom && inputCustom) {
    const newBtnAddRaw = btnAddRaw.cloneNode(true);
    btnAddRaw.parentNode.replaceChild(newBtnAddRaw, btnAddRaw);
    
    const newBtnEnhanceCustom = btnEnhanceCustom.cloneNode(true);
    btnEnhanceCustom.parentNode.replaceChild(newBtnEnhanceCustom, btnEnhanceCustom);

    newBtnAddRaw.addEventListener('click', () => {
      const txt = inputCustom.value.trim();
      if (!txt) {
        showPremiumToast("Please enter a question draft.", "error");
        return;
      }
      
      const newQ = {
        id: `q-custom-${Date.now()}`,
        type: 'technical',
        question: txt,
        difficulty: 'intermediate',
        rubric: 'Evaluated based on communication clarity and core competency.',
        follow_ups: []
      };
      
      if (!job.questions) job.questions = [];
      job.questions.push(newQ);
      saveStateToLocalStorage();
      renderQuestionsPane(job);
      
      inputCustom.value = "";
      showPremiumToast("Question added as-is.", "success");
      soundEngine.playChime([329.63, 523.25], 0.12, 0.08);
    });

    newBtnEnhanceCustom.addEventListener('click', async () => {
      const txt = inputCustom.value.trim();
      if (!txt) {
        showPremiumToast("Please enter a question draft.", "error");
        return;
      }
      
      newBtnEnhanceCustom.disabled = true;
      const originalText = newBtnEnhanceCustom.textContent;
      newBtnEnhanceCustom.innerHTML = `<div class="spinner-mini" style="display:inline-block; width:10px; height:10px; border:2px solid rgba(255,255,255,0.3); border-top-color:#ffffff; border-radius:50%; animation:spin-mini 0.6s linear infinite; margin-right:4px;"></div> Enhancing...`;

      soundEngine.playChime([392, 440], 0.08, 0.08);

      const systemPrompt = `You are an expert in designing interview questions.
Given a draft interview question, enhance it to be more precise, professional, and effective.

Return a JSON object with:
- "enhanced_question": an improved, clearer version.
- "rubric": a short guide on what to look for in the candidate's answer.
- "follow_ups": a list of 2 suggested follow-up questions.
Output ONLY valid JSON starting with { and ending with }. Do not wrap in markdown or add explanations.`;

      try {
        const responseText = await callDeepSeekAPI([
          { role: "system", content: systemPrompt },
          { role: "user", content: `Enhance this interview question:\n${txt}` }
        ], true);

        const cleanText = sanitizeJSONResponse(responseText);
        const parsed = JSON.parse(cleanText);
        
        if (parsed) {
          openEnhanceModal(txt, (enhancedData) => {
            const newQ = {
              id: `q-custom-enhanced-${Date.now()}`,
              type: 'technical',
              question: enhancedData.question,
              difficulty: 'intermediate',
              rubric: enhancedData.rubric,
              follow_ups: enhancedData.follow_ups
            };
            
            if (!job.questions) job.questions = [];
            job.questions.push(newQ);
            saveStateToLocalStorage();
            renderQuestionsPane(job);
            
            inputCustom.value = "";
            showPremiumToast("Enhanced question added.", "success");
          }, parsed);
        }
      } catch (err) {
        console.error("Enhancement failed:", err);
        showPremiumToast("Failed to enhance question. Please verify your prompt or API status.", "error");
      } finally {
        newBtnEnhanceCustom.disabled = false;
        newBtnEnhanceCustom.textContent = originalText;
      }
    });
  }

  // Wire pill groups (sleek replacement for Focus/Difficulty selects) — auto mode is default
  document.querySelectorAll('#jd-pane-questions .qg-pill-group').forEach(group => {
    const targetId = group.getAttribute('data-target');
    const hidden = document.getElementById(targetId);
    if (!hidden) return;

    const pills = group.querySelectorAll('.qg-pill');
    // sync initial from hidden (or first)
    const cur = hidden.value || 'mixed';
    pills.forEach(p => p.classList.toggle('active', p.getAttribute('data-val') === cur));

    pills.forEach(p => {
      p.onclick = () => {
        pills.forEach(pp => pp.classList.remove('active'));
        p.classList.add('active');
        hidden.value = p.getAttribute('data-val');
      };
    });
  });

  // File upload for Question Studio Job Description
  const btnUploadQgJd = document.getElementById('btn-upload-qg-jd');
  const qgJdFileInput = document.getElementById('qg-jd-file-input');
  if (btnUploadQgJd && qgJdFileInput) {
    // clone to remove any stale event listeners
    const newBtnUpload = btnUploadQgJd.cloneNode(true);
    btnUploadQgJd.parentNode.replaceChild(newBtnUpload, btnUploadQgJd);
    
    const newFileInput = qgJdFileInput.cloneNode(true);
    qgJdFileInput.parentNode.replaceChild(newFileInput, qgJdFileInput);

    newBtnUpload.addEventListener('click', () => newFileInput.click());
    newFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target.result;
        const textarea = document.getElementById('jd-raw-description');
        if (textarea) {
          textarea.value = text;
          // Trigger input event to auto-save to localStorage
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          showPremiumToast(`Loaded "${file.name}"`, "success");
          soundEngine.playChime([523.25], 0.1, 0.08);
        }
      };
      reader.onerror = () => {
        showPremiumToast("Failed to read file", "error");
      };
      reader.readAsText(file);
    });
  }

  // Global rubric collapse/expand toggler
  const btnToggleAll = document.getElementById('btn-toggle-all-rubrics');
  if (btnToggleAll && job.questions && job.questions.length > 0) {
    const isAnyExpanded = job.questions.some(q => !q.collapsed);
    btnToggleAll.textContent = isAnyExpanded ? 'Collapse All' : 'Expand All';
    btnToggleAll.style.display = 'inline-flex';

    // clone to remove any stale event listeners
    const newBtnToggleAll = btnToggleAll.cloneNode(true);
    btnToggleAll.parentNode.replaceChild(newBtnToggleAll, btnToggleAll);

    newBtnToggleAll.addEventListener('click', () => {
      const targetState = isAnyExpanded; // if any are expanded, collapse all
      job.questions.forEach(q => {
        q.collapsed = targetState;
      });
      saveStateToLocalStorage();
      renderQuestionsPane(job);
      soundEngine.playClick();
    });
  } else if (btnToggleAll) {
    btnToggleAll.style.display = 'none';
  }
}

function showStagingArea(job) {
  const stagingArea = document.getElementById('jd-staging-area');
  const stagingList = document.getElementById('staging-questions-list');
  if (!stagingArea || !stagingList) return;
  
  stagingArea.hidden = false;
  
  stagingList.innerHTML = questionStaging.list.map((q, idx) => `
    <div class="qg-staging-item">
      <div class="qg-staging-item-top">
        <div class="qg-staging-item-badges">
          <select class="staging-type-select qg-staging-select" data-idx="${idx}">
            <option value="technical" ${q.type === 'technical' ? 'selected' : ''}>Technical</option>
            <option value="behavioral" ${q.type === 'behavioral' ? 'selected' : ''}>Behavioral</option>
            <option value="situational" ${q.type === 'situational' ? 'selected' : ''}>Situational</option>
          </select>
          <select class="staging-diff-select qg-staging-select" data-idx="${idx}">
            <option value="beginner" ${q.difficulty === 'beginner' ? 'selected' : ''}>Beginner</option>
            <option value="intermediate" ${q.difficulty === 'intermediate' ? 'selected' : ''}>Intermediate</option>
            <option value="advanced" ${q.difficulty === 'advanced' ? 'selected' : ''}>Advanced</option>
          </select>
        </div>
        <button type="button" class="btn-staging-discard-item" data-idx="${idx}" aria-label="Remove from batch">&times;</button>
      </div>
      <div class="qg-staging-q">${q.question}</div>
      <div class="qg-staging-rubric">Rubric: ${q.rubric}</div>
    </div>
  `).join('');

  stagingList.querySelectorAll('.staging-type-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const idx = parseInt(sel.getAttribute('data-idx'));
      questionStaging.list[idx].type = sel.value;
    });
  });
  stagingList.querySelectorAll('.staging-diff-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const idx = parseInt(sel.getAttribute('data-idx'));
      questionStaging.list[idx].difficulty = sel.value;
    });
  });

  stagingList.querySelectorAll('.btn-staging-discard-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'));
      questionStaging.list.splice(idx, 1);
      if (questionStaging.list.length === 0) {
        stagingArea.hidden = true;
      } else {
        showStagingArea(job);
      }
    });
  });

  const btnReplace = document.getElementById('btn-staging-replace');
  const newBtnReplace = btnReplace.cloneNode(true);
  btnReplace.parentNode.replaceChild(newBtnReplace, btnReplace);
  
  newBtnReplace.addEventListener('click', () => {
    job.questions = [...questionStaging.list];
    saveStateToLocalStorage();
    stagingArea.hidden = true;
    renderQuestionsPane(job);
    showPremiumToast("Interview questions replaced with generated set.", "success");
    soundEngine.playChime([261.63, 392, 523.25], 0.2, 0.08);
  });

  const btnAppend = document.getElementById('btn-staging-append');
  const newBtnAppend = btnAppend.cloneNode(true);
  btnAppend.parentNode.replaceChild(newBtnAppend, btnAppend);
  
  newBtnAppend.addEventListener('click', () => {
    if (!job.questions) job.questions = [];
    job.questions = job.questions.concat(questionStaging.list);
    saveStateToLocalStorage();
    stagingArea.hidden = true;
    renderQuestionsPane(job);
    showPremiumToast("Generated questions appended to list.", "success");
    soundEngine.playChime([261.63, 329.63, 392, 523.25], 0.2, 0.08);
  });

  const btnCloseStaging = document.getElementById('btn-close-staging');
  const newBtnCloseStaging = btnCloseStaging.cloneNode(true);
  btnCloseStaging.parentNode.replaceChild(newBtnCloseStaging, btnCloseStaging);
  
  newBtnCloseStaging.addEventListener('click', () => {
    stagingArea.hidden = true;
    soundEngine.playClick();
  });
}

function openEnhanceModal(originalQuestion, onAcceptCallback, precalculatedData = null) {
  const modal = document.getElementById('enhance-modal');
  if (!modal) return;
  
  modal.style.display = 'flex';
  
  document.getElementById('modal-original-text').textContent = originalQuestion;
  const enhancedTextarea = document.getElementById('modal-enhanced-text');
  const rubricTextarea = document.getElementById('modal-rubric-text');
  const followUpsContainer = document.getElementById('modal-follow-ups');
  
  if (precalculatedData) {
    enhancedTextarea.value = precalculatedData.enhanced_question || originalQuestion;
    rubricTextarea.value = precalculatedData.rubric || "";
    
    const followUps = precalculatedData.follow_ups || [];
    followUpsContainer.innerHTML = followUps.map((f, idx) => `
      <input type="text" class="modal-followup-input" data-idx="${idx}" value="${f}" style="width: 100%; border-radius: 6px; border: 1px solid var(--glass-border); padding: 8px; color: var(--color-text-primary); background: rgba(0,0,0,0.25); font-family: var(--font-body); font-size: 0.8rem; outline: none;" />
    `).join('');
  } else {
    enhancedTextarea.value = "Loading enhancement...";
    rubricTextarea.value = "Loading rubric...";
    followUpsContainer.innerHTML = `<span style="color:var(--color-text-faint); font-size:0.8rem;">Fetching suggestions...</span>`;
    
    const systemPrompt = `You are an expert in designing interview questions.
Given a draft interview question, enhance it to be more precise, professional, and effective.

Return a JSON object with:
- "enhanced_question": an improved, clearer version.
- "rubric": a short guide on what to look for in the candidate's answer.
- "follow_ups": a list of 2 suggested follow-up questions.
Output ONLY valid JSON starting with { and ending with }. Do not wrap in markdown or add explanations.`;

    callDeepSeekAPI([
      { role: "system", content: systemPrompt },
      { role: "user", content: `Enhance this interview question:\n${originalQuestion}` }
    ], true).then(responseText => {
      const cleanText = sanitizeJSONResponse(responseText);
      const parsed = JSON.parse(cleanText);
      if (parsed) {
        enhancedTextarea.value = parsed.enhanced_question || originalQuestion;
        rubricTextarea.value = parsed.rubric || "";
        const followUps = parsed.follow_ups || [];
        followUpsContainer.innerHTML = followUps.map((f, idx) => `
          <input type="text" class="modal-followup-input" data-idx="${idx}" value="${f}" style="width: 100%; border-radius: 6px; border: 1px solid var(--glass-border); padding: 8px; color: var(--color-text-primary); background: rgba(0,0,0,0.25); font-family: var(--font-body); font-size: 0.8rem; outline: none;" />
        `).join('');
      }
    }).catch(err => {
      console.error("Enhancement fetch failed:", err);
      enhancedTextarea.value = originalQuestion;
      rubricTextarea.value = "Failed to load rubric suggestion.";
      followUpsContainer.innerHTML = `<span style="color:#ef4444; font-size:0.8rem;">Failed to fetch suggestions.</span>`;
    });
  }

  const closeModal = () => {
    modal.style.display = 'none';
    soundEngine.playClick();
  };
  
  const btnClose = document.getElementById('btn-close-enhance-modal');
  const newBtnClose = btnClose.cloneNode(true);
  btnClose.parentNode.replaceChild(newBtnClose, btnClose);
  newBtnClose.addEventListener('click', closeModal);
  
  const btnCancel = document.getElementById('btn-cancel-enhance');
  const newBtnCancel = btnCancel.cloneNode(true);
  btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
  newBtnCancel.addEventListener('click', closeModal);

  const btnAccept = document.getElementById('btn-accept-enhance');
  const newBtnAccept = btnAccept.cloneNode(true);
  btnAccept.parentNode.replaceChild(newBtnAccept, btnAccept);
  
  newBtnAccept.addEventListener('click', () => {
    const questionText = enhancedTextarea.value.trim();
    const rubricText = rubricTextarea.value.trim();
    const followUps = [];
    followUpsContainer.querySelectorAll('.modal-followup-input').forEach(inp => {
      if (inp.value.trim() !== "") {
        followUps.push(inp.value.trim());
      }
    });
    
    onAcceptCallback({
      question: questionText,
      rubric: rubricText,
      follow_ups: followUps
    });
    
    modal.style.display = 'none';
    soundEngine.playChime([329.63, 392, 523.25], 0.15, 0.1);
  });
}


export { generateQuestionsLocally, openEnhanceModal, questionStaging, renderQuestionsPane, showStagingArea };
