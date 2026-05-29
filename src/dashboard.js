import * as THREE from 'three';
import { gsap } from 'gsap';

// ==========================================
// AUDIO SYNTHESIZER ENGINE (Synced with main.js)
// ==========================================
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = true;
    this.lastSliderSoundTime = 0;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }

  playChime(notes, duration = 0.1, delayMultiplier = 0.15) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    notes.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + index * delayMultiplier);
      
      gainNode.gain.setValueAtTime(0, now + index * delayMultiplier);
      gainNode.gain.linearRampToValueAtTime(0.05, now + index * delayMultiplier + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + index * delayMultiplier + duration);
      
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      osc.start(now + index * delayMultiplier);
      osc.stop(now + index * delayMultiplier + duration);
    });
  }

  playClick() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.setValueAtTime(640, now + 0.03);

    gainNode.gain.setValueAtTime(0.03, now);
    gainNode.gain.linearRampToValueAtTime(0.015, now + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }
}

const soundEngine = new SoundEngine();

// ==========================================
// STATE STORE
// ==========================================
const AppState = {
  activeTab: 'jobs',
  activeSubtab: '',
  activeJobId: null,
  jobsFilter: 'all',
  teamFilter: 'all',
  tableSearch: '',
  globalSearch: '',
  jobsSortKey: 'id',
  jobsSortAsc: true,
  analyticsSubtab: 'jobs-data',
  
  jobs: [
    {
      id: 'AKRO62EF45E26EA1',
      roleName: 'Government Tender & Proposal Executive',
      cardName: 'Government Tender & Proposal Executive..',
      created: '10/03/2026, 04:08 PM',
      status: 'published',
      customJobId: '-',
      experienceBand: 'Upto 2 Years',
      createdBy: 'Devasri',
      description: "We are seeking a detail-oriented Government Tender & Proposal Executive to manage and lead the preparation, review, and submission of bids, tenders, and proposals for public sector opportunities. Key duties include analyzing RFP guidelines, checking compliance matrices, and writing clear technical and operational responses.",
      pipeline: {
        total: 3,
        resume: 0,
        screening: 2,
        functional: 1
      },
      questions: [
        {
          id: 'q-prop-1',
          type: 'technical',
          question: "Explain the process of drafting a government RFP response. What are the key compliance elements you verify before submission?",
          difficulty: 'intermediate',
          rubric: "Identifies compliance checklists, standard submission formats, and verification protocols.",
          follow_ups: ["How do you handle late updates to tender guidelines?", "What tools do you use for tracking deadline milestones?"]
        },
        {
          id: 'q-prop-2',
          type: 'behavioral',
          question: "Describe a time when you had to meet an extremely tight deadline for a critical proposal. How did you organize your tasks?",
          difficulty: 'beginner',
          rubric: "Mentions prioritization, time management, keeping key stakeholders aligned, and maintaining accuracy under pressure.",
          follow_ups: ["Did you make any errors in that rush?", "What would you do differently next time?"]
        },
        {
          id: 'q-prop-3',
          type: 'situational',
          question: "A key subject matter expert (SME) fails to deliver their input 2 hours before a tender submission deadline. How do you handle this?",
          difficulty: 'advanced',
          rubric: "Proposes logical mitigation strategies like escalation plans, using boilerplate content, or direct intervention to secure crucial technical details.",
          follow_ups: ["How do you prevent this issue in advance?", "How do you communicate the emergency to leadership?"]
        }
      ]
    },
    {
      id: 'AKRO62EF45E26DF5',
      roleName: 'Full Stack Developer',
      cardName: 'Full Stack Developer Hiring - Demo',
      created: '03/03/2026, 11:17 AM',
      status: 'published',
      customJobId: '-',
      experienceBand: '1-4 Years',
      createdBy: 'Devasri',
      description: "We are hiring a Full Stack Developer to design, build, and support high-performance web applications. You will work with React on the frontend, Node.js and Express on the backend, and PostgreSQL for storage. Responsibilities include building responsive dashboards, optimizing latency, and ensuring data consistency across endpoints.",
      pipeline: {
        total: 1,
        resume: 0,
        screening: 0,
        functional: 1
      },
      questions: [
        {
          id: 'q-dev-1',
          type: 'technical',
          question: "Describe the differences between optimistic UI updates and pessimistic UI updates. When would you use each?",
          difficulty: 'intermediate',
          rubric: "Explains user experience vs data consistency, error handling, and rollback logic in state managers.",
          follow_ups: ["How do you handle temporary network failures?", "Can you describe a scenario where optimistic updates fail badly?"]
        },
        {
          id: 'q-dev-2',
          type: 'behavioral',
          question: "Tell me about a time you had a technical disagreement with a team lead or colleague. How was it resolved?",
          difficulty: 'beginner',
          rubric: "Highlights constructive communication, presenting data-backed arguments, testing hypotheses, and committing to the final team decision.",
          follow_ups: ["What did you learn from their perspective?", "Did it affect your working relationship afterwards?"]
        },
        {
          id: 'q-dev-3',
          type: 'situational',
          question: "We are experiencing a sudden spike in database read latency during peak hours. Walk me through your debugging steps.",
          difficulty: 'advanced',
          rubric: "Mentions slow query logs, connection pools, indexing, caching layers (Redis), replica scaling, and server utilization checks.",
          follow_ups: ["How would you explain the downtime to a non-technical manager?", "What long-term safeguards would you set up?"]
        }
      ]
    }
  ],
  
  candidates: [
    {
      id: 'CAN-8234-EA1',
      name: 'Aditya Rana',
      email: 'aditya@IntervieHire.com',
      jobApplied: 'Full Stack Developer',
      status: 'Functional',
      score: '94%',
      registeredOn: '04 Mar 2026, 10:15 AM'
    },
    {
      id: 'CAN-7128-DF5',
      name: 'Devasri Bali',
      email: 'devasri@company.com',
      jobApplied: 'Government Tender & Proposal Executive',
      status: 'Functional',
      score: '96%',
      registeredOn: '11 Mar 2026, 02:40 PM'
    },
    {
      id: 'CAN-3401-EA1',
      name: 'Ines Caetano',
      email: 'ines@design.io',
      jobApplied: 'Government Tender & Proposal Executive',
      status: 'Screening',
      score: '87%',
      registeredOn: '12 Mar 2026, 09:12 AM'
    },
    {
      id: 'CAN-9012-EA2',
      name: 'Sarah Jenkins',
      email: 'sarah.j@techcorp.com',
      jobApplied: 'Government Tender & Proposal Executive',
      status: 'Screening',
      score: '91%',
      registeredOn: '13 Mar 2026, 11:05 AM'
    },
    {
      id: 'CAN-4402-RA1',
      name: 'Rohan Mehta',
      email: 'rohan.mehta@hire.io',
      jobApplied: 'Full Stack Developer',
      status: 'Resume',
      score: '—',
      registeredOn: '28 May 2026, 09:00 AM'
    },
    {
      id: 'CAN-5501-RA2',
      name: 'Priya Sharma',
      email: 'priya.sharma@bd.in',
      jobApplied: 'Government Tender & Proposal Executive',
      status: 'Resume',
      score: '—',
      registeredOn: '28 May 2026, 10:30 AM'
    },
    {
      id: 'CAN-5502-RA3',
      name: 'Arjun Verma',
      email: 'arjun.v@proposals.co',
      jobApplied: 'Government Tender & Proposal Executive',
      status: 'Resume',
      score: '—',
      registeredOn: '28 May 2026, 11:15 AM'
    }
  ],

  team: [
    {
      name: 'Devasri',
      email: 'devasri@zeko.ai',
      designation: 'Org. Admin',
      usertype: 'Org. Admin',
      registeredOn: '26 Feb 2026, 05:33 PM',
      status: 'Active'
    }
  ],
  visibleColumnsAnalyticsJobs: ['id', 'roleName', 'cardName', 'customJobId', 'experienceBand', 'tags', 'createdBy', 'collaborators', 'recruiters'],
  visibleColumnsAnalyticsCandidates: ['id', 'name', 'jobApplied', 'registeredOn', 'status', 'score', 'actions'],
  visibleColumnsTeam: ['member', 'designation', 'usertype', 'registeredOn', 'status', 'actions'],
  agentConfigs: {
    aria: {
      model: 'gpt-4o',
      temperature: 0.2,
      threshold: 80,
      prompt: 'You are Lina, the Resume Analyst Agent. Your job is to extract candidate experience, skills, and check eligibility for public tenders. Screen out any profiles below the match score threshold.'
    },
    kaelen: {
      model: 'claude-3-5-sonnet',
      temperature: 0.5,
      threshold: 85,
      prompt: 'You are Kaelen, the Technical Vetting Specialist. Evaluate code submissions for correctness, clean structure, memory leak preventions, and correct algorithmic complexity.'
    },
    lyra: {
      model: 'gpt-4o',
      temperature: 0.7,
      threshold: 75,
      prompt: 'You are Lyra, the HR Communications Bot. Draft friendly invitations to candidates, schedule interviews, and handle follow-up emails regarding their screening status.'
    }
  }
};

// Helper for generating custom job IDs
function generateJobId() {
  const chars = '0123456789ABCDEF';
  let id = 'AKRO62EF45E2';
  for (let i = 0; i < 4; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// ==========================================
// RENDERING & INTERACTIVE VIEWS
// ==========================================

// 1. Render Job Cards (Jobs View)
function renderJobCards() {
  const container = document.getElementById('jobs-list-container');
  if (!container) return;

  container.innerHTML = '';
  const filteredJobs = AppState.jobs.filter(job => {
    // Filter status tabs
    if (AppState.jobsFilter !== 'all' && job.status !== AppState.jobsFilter) return false;
    // Search query
    if (AppState.globalSearch) {
      const query = AppState.globalSearch.toLowerCase();
      return job.roleName.toLowerCase().includes(query) || job.id.toLowerCase().includes(query);
    }
    return true;
  });

  // Update count indicators on filtering headers
  updateJobsCounters();

  if (filteredJobs.length === 0) {
    container.innerHTML = `
      <div class="empty-state card-glass" style="grid-column: 1/-1; padding: 48px; text-align: center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" stroke-width="1.5" style="margin-bottom: 16px;">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
        </svg>
        <h3 class="type-h3" style="margin-bottom: 8px;">No jobs found</h3>
        <p class="type-caption">No job postings match your filters. Create a new job to start recruitment.</p>
      </div>
    `;
    return;
  }

  filteredJobs.forEach(job => {
    const card = document.createElement('div');
    card.className = 'job-card';
    
    // Build safe defaults for all fields
    const createdBy = job.createdBy || 'Devasri';
    const experienceBand = job.experienceBand || 'Upto 2 Years';
    const created = job.created || 'Recently';
    const pipeline = job.pipeline || { total: 0, resume: 0, screening: 0, functional: 0 };
    const cardName = job.cardName || job.roleName || 'Untitled Job';
    const roleName = job.roleName || 'Untitled Role';
    const status = job.status || 'published';
    const jobId = job.id || 'unknown';

    // Build pipeline values
    const resumeVal = pipeline.resume === 0 || pipeline.resume === null ? '-' : pipeline.resume;
    const screeningVal = pipeline.screening === 0 || pipeline.screening === null ? '-' : pipeline.screening;
    const functionalVal = pipeline.functional === 0 || pipeline.functional === null ? '-' : pipeline.functional;

    card.innerHTML = `
      <div class="job-card-header">
        <div class="job-card-title-area">
          <h3 class="job-title">${cardName}</h3>
          <span class="job-meta-pill">Role: ${roleName}</span>
        </div>
        <span class="status-badge ${status}">
          <span class="status-badge-dot"></span>
          ${status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>
      
      <div class="job-card-details">
        <div class="detail-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          <span>Created: ${created}</span>
        </div>
        <div class="detail-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          <span>Experience: ${experienceBand}</span>
        </div>
      </div>

      <div class="pipeline-flow">
        <div class="pipeline-step step-total">
          <span class="step-label">Total</span>
          <span class="step-val">${pipeline.total}</span>
        </div>
        <span class="pipeline-arrow">→</span>
        <div class="pipeline-step step-resume">
          <span class="step-label">Resume</span>
          <span class="step-val">${resumeVal}</span>
        </div>
        <span class="pipeline-arrow">→</span>
        <div class="pipeline-step step-screening">
          <span class="step-label">Screening</span>
          <span class="step-val">${screeningVal}</span>
        </div>
        <span class="pipeline-arrow">→</span>
        <div class="pipeline-step step-functional">
          <span class="step-label">Functional</span>
          <span class="step-val">${functionalVal}</span>
        </div>
      </div>

      <div class="job-card-footer">
        <div class="author-info">
          <div class="author-tag">${createdBy.charAt(0)}</div>
          <span class="author-meta">${createdBy} (me) // <a href="#" class="author-link-doc" onclick="event.stopPropagation(); openJobDescriptionDrawer('${jobId}')">Job Description</a></span>
        </div>
        <span class="card-responses-cta">
          View Responses
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </span>
      </div>
    `;

    card.addEventListener('click', () => {
      navigateToJobDetail(jobId);
    });

    container.appendChild(card);
  });
}

// Update counts displayed on filter tabs
function updateJobsCounters() {
  const allCount = AppState.jobs.length;
  const publishedCount = AppState.jobs.filter(j => j.status === 'published').length;
  const draftCount = AppState.jobs.filter(j => j.status === 'draft').length;
  const archivedCount = AppState.jobs.filter(j => j.status === 'archived').length;

  document.querySelector('.count-all').textContent = allCount;
  document.querySelector('.count-published').textContent = publishedCount;
  document.querySelector('.count-draft').textContent = draftCount;
  document.querySelector('.count-archived').textContent = archivedCount;
}

// 2. Render Table (Analytics View)
function renderAnalyticsTable() {
  const table = document.getElementById('analytics-jobs-table');
  const tbody = document.getElementById('analytics-table-body');
  if (!tbody || !table) return;

  tbody.innerHTML = '';
  
  // Dynamic header updates depending on subtab
  const headers = table.querySelector('thead tr');
  const searchVal = AppState.tableSearch.toLowerCase();
  
  if (AppState.analyticsSubtab === 'jobs-data') {
    const visible = AppState.visibleColumnsAnalyticsJobs;
    let headerHtml = '';
    
    if (visible.includes('id')) headerHtml += `<th class="sortable" data-sort="id">Job ID <span class="arrow">${AppState.jobsSortKey === 'id' ? (AppState.jobsSortAsc ? '↑' : '↓') : '↕'}</span></th>`;
    if (visible.includes('roleName')) headerHtml += `<th class="sortable" data-sort="role">Role Name <span class="arrow">${AppState.jobsSortKey === 'role' ? (AppState.jobsSortAsc ? '↑' : '↓') : '↕'}</span></th>`;
    if (visible.includes('cardName')) headerHtml += `<th class="sortable" data-sort="card">Card Name <span class="arrow">${AppState.jobsSortKey === 'card' ? (AppState.jobsSortAsc ? '↑' : '↓') : '↕'}</span></th>`;
    if (visible.includes('customJobId')) headerHtml += `<th>Custom Job ID</th>`;
    if (visible.includes('experienceBand')) headerHtml += `<th>Experience Band</th>`;
    if (visible.includes('tags')) headerHtml += `<th>Tags</th>`;
    if (visible.includes('createdBy')) headerHtml += `<th>Job Created By</th>`;
    if (visible.includes('collaborators')) headerHtml += `<th>Collaborators</th>`;
    if (visible.includes('recruiters')) headerHtml += `<th>Recruiters</th>`;
    
    headers.innerHTML = headerHtml;

    // Process Sort & Search on Jobs
    let list = [...AppState.jobs];
    if (searchVal) {
      list = list.filter(j => j.roleName.toLowerCase().includes(searchVal) || j.id.toLowerCase().includes(searchVal));
    }
    
    list.sort((a, b) => {
      let valA = a.id;
      let valB = b.id;
      if (AppState.jobsSortKey === 'role') {
        valA = a.roleName;
        valB = b.roleName;
      } else if (AppState.jobsSortKey === 'card') {
        valA = a.cardName;
        valB = b.cardName;
      }
      return AppState.jobsSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

    document.getElementById('analytics-table-showing').textContent = `Showing 1-${list.length} of ${list.length}`;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${visible.length}" style="text-align: center; color: var(--color-text-muted); padding: 32px;">No job data matching query</td></tr>`;
      return;
    }

    list.forEach(job => {
      const tr = document.createElement('tr');
      let cellsHtml = '';
      
      if (visible.includes('id')) cellsHtml += `<td class="cell-mono">${job.id}</td>`;
      if (visible.includes('roleName')) cellsHtml += `<td><strong>${job.roleName}</strong></td>`;
      if (visible.includes('cardName')) cellsHtml += `<td>${job.cardName}</td>`;
      if (visible.includes('customJobId')) cellsHtml += `<td>${job.customJobId}</td>`;
      if (visible.includes('experienceBand')) cellsHtml += `<td>${job.experienceBand}</td>`;
      if (visible.includes('tags')) cellsHtml += `<td style="color: var(--color-text-faint);">-</td>`;
      if (visible.includes('createdBy')) cellsHtml += `<td>${job.createdBy}</td>`;
      if (visible.includes('collaborators')) cellsHtml += `<td style="color: var(--color-text-faint);">-</td>`;
      if (visible.includes('recruiters')) cellsHtml += `<td style="color: var(--color-text-faint);">-</td>`;
      
      tr.innerHTML = cellsHtml;
      tbody.appendChild(tr);
    });

  } else {
    // Candidates data headers
    const visible = AppState.visibleColumnsAnalyticsCandidates;
    let headerHtml = '';
    
    if (visible.includes('id')) headerHtml += `<th>Candidate ID</th>`;
    if (visible.includes('name')) headerHtml += `<th>Candidate Name</th>`;
    if (visible.includes('jobApplied')) headerHtml += `<th>Job Applied</th>`;
    if (visible.includes('registeredOn')) headerHtml += `<th>Registered On</th>`;
    if (visible.includes('status')) headerHtml += `<th>Pipeline Stage</th>`;
    if (visible.includes('score')) headerHtml += `<th>Match Score</th>`;
    if (visible.includes('actions')) headerHtml += `<th>Actions</th>`;
    
    headers.innerHTML = headerHtml;

    // Filter Candidates by search
    let list = [...AppState.candidates];
    if (searchVal) {
      list = list.filter(c => c.name.toLowerCase().includes(searchVal) || c.email.toLowerCase().includes(searchVal) || c.jobApplied.toLowerCase().includes(searchVal));
    }

    document.getElementById('analytics-table-showing').textContent = `Showing 1-${list.length} of ${list.length}`;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${visible.length}" style="text-align: center; color: var(--color-text-muted); padding: 32px;">No candidates matching query</td></tr>`;
      return;
    }

    list.forEach(c => {
      const tr = document.createElement('tr');
      let cellsHtml = '';
      
      if (visible.includes('id')) cellsHtml += `<td class="cell-mono">${c.id}</td>`;
      if (visible.includes('name')) {
        cellsHtml += `
          <td>
            <div class="user-cell">
              <div class="user-avatar-mini">${c.name.split(' ').map(n => n[0]).join('')}</div>
              <div class="user-details">
                <span style="font-weight: 600;">${c.name}</span>
                <span class="user-email-mini">${c.email}</span>
              </div>
            </div>
          </td>
        `;
      }
      if (visible.includes('jobApplied')) cellsHtml += `<td>${c.jobApplied}</td>`;
      if (visible.includes('registeredOn')) cellsHtml += `<td class="cell-mono">${c.registeredOn}</td>`;
      if (visible.includes('status')) {
        cellsHtml += `
          <td>
            <span class="badge-role ${c.status === 'Screening' ? 'recruiter' : 'interviewer'}">
              <span class="badge-role-icon"></span>
              ${c.status}
            </span>
          </td>
        `;
      }
      if (visible.includes('score')) {
        cellsHtml += `
          <td>
            <strong style="color: var(--color-gold); text-shadow: 0 0 8px var(--color-gold-glow); font-family: var(--font-mono);">${c.score}</strong>
          </td>
        `;
      }
      if (visible.includes('actions')) {
        cellsHtml += `
          <td>
            <button class="table-btn-action btn-view-report-from-table" data-candidate-id="${c.id}" title="View Full Report">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
          </td>
        `;
      }
      
      tr.innerHTML = cellsHtml;
      tbody.appendChild(tr);
    });
    
    // Bind click handlers to full report buttons in the table
    tbody.querySelectorAll('.btn-view-report-from-table').forEach(btn => {
      btn.addEventListener('click', () => {
        const candId = btn.getAttribute('data-candidate-id');
        openCandidateReport(candId);
      });
    });
  }

  // Bind sort listeners on headers
  const sortHeaders = table.querySelectorAll('th.sortable');
  sortHeaders.forEach(th => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-sort');
      if (AppState.jobsSortKey === key) {
        AppState.jobsSortAsc = !AppState.jobsSortAsc;
      } else {
        AppState.jobsSortKey = key;
        AppState.jobsSortAsc = true;
      }
      soundEngine.playClick();
      renderAnalyticsTable();
    });
  });
}

// 3. Render Team Access Table (Team View)
function renderTeamTable() {
  const tbody = document.getElementById('team-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';
  
  const searchVal = document.getElementById('team-search').value.toLowerCase();
  const roleVal = document.getElementById('team-role-filter').value;
  
  const filteredTeam = AppState.team.filter(member => {
    // Status filters
    if (AppState.teamFilter !== 'all' && member.status.toLowerCase() !== AppState.teamFilter) return false;
    // Role filter
    if (roleVal !== 'all' && member.usertype !== roleVal) return false;
    // Search query
    if (searchVal) {
      return member.name.toLowerCase().includes(searchVal) || member.email.toLowerCase().includes(searchVal);
    }
    return true;
  });

  // Update team filters indicators
  updateTeamCounters();

  document.getElementById('team-table-showing').textContent = `Showing 1-${filteredTeam.length} of ${filteredTeam.length}`;

  const visible = AppState.visibleColumnsTeam;
  const headers = document.querySelector('#team-members-table thead tr');
  if (headers) {
    let headerHtml = '';
    if (visible.includes('member')) headerHtml += `<th>Team Member</th>`;
    if (visible.includes('designation')) headerHtml += `<th>Designation</th>`;
    if (visible.includes('usertype')) headerHtml += `<th>Usertype</th>`;
    if (visible.includes('registeredOn')) headerHtml += `<th>Registered On</th>`;
    if (visible.includes('status')) headerHtml += `<th>Status</th>`;
    if (visible.includes('actions')) headerHtml += `<th>Actions</th>`;
    headers.innerHTML = headerHtml;
  }

  if (filteredTeam.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${visible.length}" style="text-align: center; color: var(--color-text-muted); padding: 32px;">No team members matching criteria</td></tr>`;
    return;
  }

  filteredTeam.forEach(member => {
    const tr = document.createElement('tr');
    
    // Status styles
    let statusClass = 'published';
    if (member.status === 'Invited') statusClass = 'draft';
    else if (member.status === 'Inactive') statusClass = 'archived';
    
    let cellsHtml = '';
    if (visible.includes('member')) {
      cellsHtml += `
        <td>
          <div class="user-cell">
            <div class="user-avatar-mini" style="background-color: var(--color-gold-dim); border-color: var(--color-gold); color: var(--color-gold-light);">${member.name.charAt(0)}</div>
            <div class="user-details">
              <span style="font-weight: 600;">${member.name} ${member.name === 'Devasri' ? '(me)' : ''}</span>
              <span class="user-email-mini">${member.email}</span>
            </div>
          </div>
        </td>
      `;
    }
    if (visible.includes('designation')) cellsHtml += `<td>${member.designation}</td>`;
    if (visible.includes('usertype')) {
      if (member.name === 'Devasri') {
        cellsHtml += `
          <td>
            <span class="badge-role">
              <span class="badge-role-icon"></span>
              ${member.usertype}
            </span>
          </td>
        `;
      } else {
        cellsHtml += `
          <td>
            <select class="select-styled-table team-usertype-select" data-email="${member.email}">
              <option value="Org. Admin" ${member.usertype === 'Org. Admin' ? 'selected' : ''}>Org. Admin</option>
              <option value="Recruiter" ${member.usertype === 'Recruiter' ? 'selected' : ''}>Recruiter</option>
              <option value="Interviewer" ${member.usertype === 'Interviewer' ? 'selected' : ''}>Interviewer</option>
            </select>
          </td>
        `;
      }
    }
    if (visible.includes('registeredOn')) cellsHtml += `<td class="cell-mono">${member.registeredOn}</td>`;
    if (visible.includes('status')) {
      if (member.name === 'Devasri') {
        cellsHtml += `
          <td>
            <span class="status-badge published">
              <span class="status-badge-dot"></span>
              ${member.status}
            </span>
          </td>
        `;
      } else {
        cellsHtml += `
          <td>
            <select class="select-styled-table team-status-select" data-email="${member.email}">
              <option value="Active" ${member.status === 'Active' ? 'selected' : ''}>Active</option>
              <option value="Inactive" ${member.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
              <option value="Invited" ${member.status === 'Invited' ? 'selected' : ''}>Invited</option>
            </select>
          </td>
        `;
      }
    }
    if (visible.includes('actions')) {
      cellsHtml += `
        <td>
          <button class="table-btn-action btn-revoke-member" data-email="${member.email}" style="color: var(--color-orange);" title="Deactivate/Revoke Member" ${member.name === 'Devasri' ? 'disabled style="opacity: 0.2; cursor: not-allowed;"' : ''}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
          </button>
        </td>
      `;
    }
    
    tr.innerHTML = cellsHtml;
    tbody.appendChild(tr);
  });

  // Bind change/click events to inline dropdowns & buttons
  tbody.querySelectorAll('.team-usertype-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const email = sel.getAttribute('data-email');
      const member = AppState.team.find(m => m.email === email);
      if (member) {
        member.usertype = e.target.value;
        soundEngine.playChime([523.25], 0.1);
        showPremiumToast(`${member.name}'s role updated to ${member.usertype}.`, 'success');
        renderTeamTable();
      }
    });
  });

  tbody.querySelectorAll('.team-status-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const email = sel.getAttribute('data-email');
      const member = AppState.team.find(m => m.email === email);
      if (member) {
        member.status = e.target.value;
        soundEngine.playChime([523.25], 0.1);
        showPremiumToast(`${member.name}'s status updated to ${member.status}.`, 'success');
        renderTeamTable();
      }
    });
  });

  tbody.querySelectorAll('.btn-revoke-member').forEach(btn => {
    btn.addEventListener('click', () => {
      const email = btn.getAttribute('data-email');
      const member = AppState.team.find(m => m.email === email);
      if (member) {
        AppState.team = AppState.team.filter(m => m.email !== email);
        soundEngine.playChime([392, 293.66], 0.15, 0.08);
        showPremiumToast(`${member.name} has been revoked from the team access list.`, 'success');
        renderTeamTable();
      }
    });
  });
}

function updateTeamCounters() {
  const total = AppState.team.length;
  const active = AppState.team.filter(t => t.status === 'Active').length;
  const invited = AppState.team.filter(t => t.status === 'Invited').length;
  const inactive = AppState.team.filter(t => t.status === 'Inactive').length;

  document.querySelector('.team-count-all').textContent = total;
  document.querySelector('.team-count-active').textContent = active;
  document.querySelector('.team-count-invited').textContent = invited;
  document.querySelector('.team-count-inactive').textContent = inactive;
}

// 4. Update Summary Metrics (Analytics View Header Stats)
function updateSummaryMetrics() {
  let totalApplicants = 0;
  let resumeCount = 0;
  let screeningCount = 0;
  let functionalCount = 0;

  AppState.jobs.forEach(job => {
    totalApplicants += job.pipeline.total || 0;
    resumeCount += job.pipeline.resume || 0;
    screeningCount += job.pipeline.screening || 0;
    functionalCount += job.pipeline.functional || 0;
  });

  document.getElementById('stat-total-applicants').textContent = totalApplicants;
  document.getElementById('stat-resume-analysis').textContent = resumeCount;
  document.getElementById('stat-recruiter-screening').textContent = screeningCount;
  document.getElementById('stat-functional-interview').textContent = functionalCount;
  
  // Sync individual pills under stats cards
  // Total applicants card pills:
  const appPills = document.querySelectorAll('.card-metric:nth-child(1) .m-pill .v');
  if (appPills.length >= 4) {
    appPills[0].textContent = 0; // Career Page
    appPills[1].textContent = 0; // Bulk Upload
    appPills[2].textContent = screeningCount; // Scheduled screening
    appPills[3].textContent = totalApplicants - screeningCount; // Direct Link / Rest
  }
  
  // Resume analysis card pills:
  const resPills = document.querySelectorAll('.card-metric:nth-child(2) .m-pill .v');
  if (resPills.length >= 3) {
    resPills[0].textContent = resumeCount; // Analysed
    resPills[1].textContent = 0; // Shortlisted
    resPills[2].textContent = 0; // Waitlisted
  }

  // Recruiter screening card pills:
  const scrPills = document.querySelectorAll('.card-metric:nth-child(3) .m-pill .v');
  if (scrPills.length >= 4) {
    scrPills[0].textContent = screeningCount > 0 ? screeningCount - 1 : 0; // Attempted
    scrPills[1].textContent = screeningCount > 0 ? 1 : 0; // Scheduled
    scrPills[2].textContent = 0; // Shortlisted
    scrPills[3].textContent = 0; // Waitlisted
  }

  // Functional interview card pills:
  const funPills = document.querySelectorAll('.card-metric:nth-child(4) .m-pill .v');
  if (funPills.length >= 4) {
    funPills[0].textContent = functionalCount > 0 ? functionalCount - 1 : 0; // Attempted
    funPills[1].textContent = functionalCount > 0 ? 1 : 0; // Scheduled
    funPills[2].textContent = 0; // Shortlisted
    funPills[3].textContent = 0; // Waitlisted
  }
}

// ==========================================
// VIEW SWITCHER ROUTING
// ==========================================
// ==========================================
// VIEW SWITCHER ROUTING
// ==========================================
function navigateToTab(tabId) {
  AppState.activeTab = tabId;
  AppState.activeSubtab = '';

  // Update Sidebar Active state
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    if (item.getAttribute('data-tab') === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Remove subtab active markers
  document.querySelectorAll('.sub-nav li').forEach(li => li.classList.remove('active-sub'));

  // Update Dynamic views display
  document.querySelectorAll('.dashboard-view').forEach(view => {
    view.classList.remove('active-view');
  });

  // Set titles & buttons contextually
  const breadcrumb = document.getElementById('breadcrumb-title');
  const mainTitle = document.getElementById('header-main-title');
  const subText = document.getElementById('header-sub-text');
  const actionBtn = document.getElementById('header-action-btn');
  const actionBtnText = document.getElementById('header-action-btn-text');

  actionBtn.style.display = 'flex'; // Reset to visible

  if (tabId === 'jobs') {
    breadcrumb.textContent = 'Jobs';
    mainTitle.textContent = 'Good morning, Devasri 🌤️';
    subText.textContent = 'A squad of AI agents working for you';
    actionBtnText.textContent = 'New Job';
    document.getElementById('view-jobs').classList.add('active-view');
    
    const isBoard = document.getElementById('btn-view-board').classList.contains('active');
    if (isBoard) {
      renderKanbanBoard();
    } else {
      renderJobCards();
    }
    soundEngine.playChime([261.63, 329.63], 0.12, 0.1);

  } else if (tabId === 'analytics') {
    breadcrumb.textContent = 'Usage Overview';
    mainTitle.textContent = 'Usage Overview';
    subText.textContent = 'Track applicants funnel metrics and pipelines';
    actionBtnText.textContent = 'New Job';
    document.getElementById('view-analytics').classList.add('active-view');
    updateSummaryMetrics();
    renderAnalyticsTable();
    soundEngine.playChime([261.63, 329.63, 392.00], 0.12, 0.12);

  } else if (tabId === 'swarm') {
    breadcrumb.textContent = 'AI Swarm';
    mainTitle.textContent = 'AI Swarm Console';
    subText.textContent = 'A squad of autonomous AI agents working for you';
    actionBtn.style.display = 'none'; // No primary CTA for swarm config page
    document.getElementById('view-swarm').classList.add('active-view');
    startSwarmLogs();
    soundEngine.playChime([261.63, 329.63, 440.00], 0.15, 0.12);

  } else if (tabId === 'team') {
    breadcrumb.textContent = 'Team Access';
    mainTitle.textContent = 'Team Access Settings';
    subText.textContent = 'Manage organisation access, usertypes, and invite collaborators';
    actionBtnText.textContent = 'Invite Member';
    document.getElementById('view-team').classList.add('active-view');
    renderTeamTable();
    soundEngine.playChime([261.63, 329.63, 493.88], 0.15, 0.12);

  } else if (tabId === 'career') {
    breadcrumb.textContent = 'Career Page';
    mainTitle.textContent = 'Career Subdomain Control';
    subText.textContent = 'Design corporate listings page appearance and themes';
    actionBtn.style.display = 'none'; // No primary CTA for career config page
    document.getElementById('view-career').classList.add('active-view');
    soundEngine.playChime([329.63, 392.00, 523.25], 0.12, 0.15);
  }
}

// ==========================================
// CREATE JOB + ARIA CHAT NAVIGATION
// ==========================================

function navigateToCreateJob() {
  AppState.activeTab = 'create-job';
  AppState.activeSubtab = '';

  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-tab') === 'jobs');
  });
  document.querySelectorAll('.sub-nav li').forEach(li => li.classList.remove('active-sub'));
  document.querySelectorAll('.dashboard-view').forEach(v => v.classList.remove('active-view'));

  const breadcrumb = document.getElementById('breadcrumb-title');
  breadcrumb.innerHTML = `<span class="breadcrumb-link" id="bc-jobs-link-cj">Jobs</span> <span class="breadcrumb-separator">/</span> Create Job`;
  document.getElementById('bc-jobs-link-cj').addEventListener('click', () => navigateToTab('jobs'));
  document.getElementById('header-main-title').textContent = 'Create Job';
  document.getElementById('header-sub-text').textContent = 'Choose how you\'d like to create your new job posting';
  document.getElementById('header-action-btn').style.display = 'none';
  document.getElementById('view-create-job').classList.add('active-view');

  // Reset create-job state
  const filePreview = document.getElementById('dropzone-file-preview');
  const pasteArea = document.getElementById('create-jd-paste');
  const dropzone = document.getElementById('jd-dropzone');
  const fileInput = document.getElementById('jd-file-input');
  if (filePreview) { filePreview.style.display = 'none'; filePreview.innerHTML = ''; }
  if (pasteArea) { pasteArea.style.display = 'none'; pasteArea.value = ''; }
  if (dropzone) dropzone.classList.remove('has-file', 'drag-over');
  if (fileInput) fileInput.value = '';
  createJobUploadedFileName = null;
  createJobUploadedText = null;

  soundEngine.playChime([392, 523.25], 0.12, 0.1);
}

let ariaChatHistory = [];

function navigateToAriaChat() {
  AppState.activeTab = 'aria-chat';
  AppState.activeSubtab = '';

  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-tab') === 'jobs');
  });
  document.querySelectorAll('.dashboard-view').forEach(v => v.classList.remove('active-view'));

  const breadcrumb = document.getElementById('breadcrumb-title');
  breadcrumb.innerHTML = `<span class="breadcrumb-link" id="bc-jobs-link-aria">Jobs</span> <span class="breadcrumb-separator">/</span> <span class="breadcrumb-link" id="bc-cj-link-aria">Create Job</span> <span class="breadcrumb-separator">/</span> Lina`;
  document.getElementById('bc-jobs-link-aria').addEventListener('click', () => navigateToTab('jobs'));
  document.getElementById('bc-cj-link-aria').addEventListener('click', navigateToCreateJob);
  document.getElementById('header-main-title').textContent = 'Lina Requisition';
  document.getElementById('header-sub-text').textContent = 'Creating a new job through AI conversation';
  document.getElementById('header-action-btn').style.display = 'none';
  document.getElementById('view-aria-chat').classList.add('active-view');

  // Reset chat
  ariaChatHistory = [];
  const messagesContainer = document.getElementById('aria-chat-messages');
  if (messagesContainer) messagesContainer.innerHTML = '';
  const chatInput = document.getElementById('aria-chat-input');
  if (chatInput) { chatInput.value = ''; chatInput.disabled = false; }
  const sendBtn = document.getElementById('btn-aria-send');
  if (sendBtn) sendBtn.disabled = false;

  // Lina opening message
  const opening = "Hi! I'm Lina, your AI recruiting assistant. Tell me about the role you're hiring for — what's the job title and what will this person be doing?";
  appendAriaMessage(opening, 'aria');
  ariaChatHistory.push({ role: 'assistant', content: opening });

  soundEngine.playChime([329.63, 392, 523.25], 0.12, 0.1);
}

function appendAriaMessage(text, sender) {
  const container = document.getElementById('aria-chat-messages');
  if (!container) return;

  const isTyping = sender === 'aria-typing';
  const row = document.createElement('div');
  row.className = `aria-msg aria-msg-from-aria${isTyping ? ' aria-msg-typing' : ''}`;

  if (sender === 'user') {
    row.className = 'aria-msg aria-msg-from-user';
    row.innerHTML = `<div class="aria-msg-bubble">${text}</div>`;
  } else {
    row.innerHTML = `
      <div class="aria-msg-avatar">A</div>
      <div class="aria-msg-bubble">${isTyping ? '<span class="dot-flash">●&nbsp;●&nbsp;●</span>' : text}</div>`;
  }

  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
  return row;
}

async function sendAriaMessage(text) {
  if (!text.trim()) return;
  const input = document.getElementById('aria-chat-input');
  const sendBtn = document.getElementById('btn-aria-send');
  input.value = '';
  input.disabled = true;
  sendBtn.disabled = true;

  appendAriaMessage(text, 'user');
  ariaChatHistory.push({ role: 'user', content: text });

  const typingRow = appendAriaMessage('', 'aria-typing');

  const systemPrompt = `You are Lina, an AI recruiting assistant for IntervieHire. Help hiring managers create job postings through a brief natural conversation.

Based on the conversation so far, determine if you have enough information to create a job posting. You need:
1. Job title / role name
2. Experience level
3. A brief description of responsibilities

If you have all three, respond ONLY with this JSON (no extra text):
{"ready":true,"roleName":"...","cardName":"...","experienceBand":"one of: Upto 2 Years | 1-4 Years | 3-6 Years | 5+ Years","description":"2-3 sentence professional job description"}

If you need more info, respond ONLY with this JSON (no extra text):
{"ready":false,"message":"your warm 1-2 sentence follow-up question"}`;

  try {
    const response = await callDeepSeekAPI([
      { role: 'system', content: systemPrompt },
      ...ariaChatHistory
    ], true);

    if (typingRow && typingRow.parentNode) typingRow.remove();

    const parsed = JSON.parse(sanitizeJSONResponse(response));

    if (parsed.ready) {
      const newJob = {
        id: generateJobId(),
        roleName: parsed.roleName,
        cardName: parsed.cardName || parsed.roleName,
        created: new Date().toLocaleString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
        status: 'published',
        customJobId: '-',
        experienceBand: parsed.experienceBand || 'Upto 2 Years',
        createdBy: 'Devasri',
        description: parsed.description,
        questions: [],
        pipeline: { total: 0, resume: 0, screening: 0, functional: 0 }
      };
      AppState.jobs.unshift(newJob);
      saveStateToLocalStorage();
      appendAriaMessage(`Perfect! I've created the "${parsed.roleName}" job posting. Taking you to the job detail now...`, 'aria');
      soundEngine.playChime([329.63, 392, 523.25, 659.25], 0.2, 0.08);
      setTimeout(() => navigateToJobDetail(newJob.id), 1400);
    } else {
      appendAriaMessage(parsed.message, 'aria');
      ariaChatHistory.push({ role: 'assistant', content: parsed.message });
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }
  } catch (err) {
    if (typingRow && typingRow.parentNode) typingRow.remove();
    appendAriaMessage("Sorry, I ran into a connectivity issue. Please try again.", 'aria');
    console.error("Lina chat error:", err);
    input.disabled = false;
    sendBtn.disabled = false;
  }
}

let createJobUploadedFileName = null;
let createJobUploadedText = null;

function navigateToSubtab(subtabId) {
  AppState.activeTab = 'settings';
  AppState.activeSubtab = subtabId;

  // Make sure settings parent menu node is visually highlighted and open
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    if (item.getAttribute('data-tab') === 'settings') {
      item.classList.add('active');
      item.classList.add('open');
    } else {
      item.classList.remove('active');
    }
  });

  // Make subtab item look selected
  document.querySelectorAll('.sub-nav li').forEach(li => {
    if (li.getAttribute('data-subtab') === subtabId) {
      li.classList.add('active-sub');
    } else {
      li.classList.remove('active-sub');
    }
  });

  // Show corresponding subtab view
  document.querySelectorAll('.dashboard-view').forEach(view => {
    view.classList.remove('active-view');
  });

  const breadcrumb = document.getElementById('breadcrumb-title');
  const mainTitle = document.getElementById('header-main-title');
  const subText = document.getElementById('header-sub-text');
  const actionBtn = document.getElementById('header-action-btn');

  actionBtn.style.display = 'none';

  if (subtabId === 'settings-password') {
    breadcrumb.textContent = 'Settings / Security';
    mainTitle.textContent = 'Admin Password Panel';
    subText.textContent = 'Change access credentials for Org. Admin';
    document.getElementById('view-settings-password').classList.add('active-view');
    soundEngine.playChime([261.63, 293.66, 329.63], 0.1, 0.08);
  } else if (subtabId === 'settings-cookies') {
    breadcrumb.textContent = 'Settings / Cookies';
    mainTitle.textContent = 'Cookie Policies';
    subText.textContent = 'Manage cookie levels and session trackers';
    document.getElementById('view-settings-cookies').classList.add('active-view');
    soundEngine.playChime([261.63, 293.66, 329.63], 0.1, 0.08);
  }
}

// ==========================================
// DRAWERS SHOW / HIDE CONTROL
// ==========================================
function openDrawer(drawerType, jobId = null) {
  const overlay = document.getElementById('drawer-backdrop');
  overlay.classList.add('active');

  soundEngine.playChime([392.00, 523.25], 0.12, 0.1);

  if (drawerType === 'job') {
    document.getElementById('drawer-job').classList.add('active');
  } else if (drawerType === 'member') {
    document.getElementById('drawer-member').classList.add('active');
  } else if (drawerType === 'view-jd') {
    const drawer = document.getElementById('drawer-view-jd');
    drawer.classList.add('active');
    if (jobId) {
      const job = AppState.jobs.find(j => j.id === jobId);
      if (job) {
        document.getElementById('drawer-jd-text').value = job.description || "";
        drawer.setAttribute('data-current-job-id', jobId);
      }
    }
  }
}

function closeDrawers() {
  document.getElementById('drawer-backdrop').classList.remove('active');
  document.getElementById('drawer-job').classList.remove('active');
  document.getElementById('drawer-member').classList.remove('active');
  
  const jdDrawer = document.getElementById('drawer-view-jd');
  if (jdDrawer) {
    jdDrawer.classList.remove('active');
  }
  
  const reportDrawer = document.getElementById('drawer-report');
  if (reportDrawer) {
    reportDrawer.classList.remove('active');
    reportDrawer.style.right = '-540px';
  }

  const agentDrawer = document.getElementById('drawer-agent-config');
  if (agentDrawer) {
    agentDrawer.classList.remove('active');
  }
  
  resetWaveformAudio();
  soundEngine.playClick();
}

// ==========================================
// EXPORTING SCRIPTS (MOCKED EXCEL EXPORTS)
// ==========================================
function triggerExcelExport(dataType) {
  soundEngine.playChime([523.25, 659.25, 783.99], 0.2, 0.08);
  
  let csvContent = "data:text/csv;charset=utf-8,";
  let filename = "export.csv";

  if (dataType === 'jobs') {
    csvContent += "Job ID,Role Name,Card Name,Experience Band,Created By\n";
    AppState.jobs.forEach(j => {
      csvContent += `"${j.id}","${j.roleName}","${j.cardName}","${j.experienceBand}","${j.createdBy}"\n`;
    });
    filename = "IntervieHire_jobs_export.csv";
  } else if (dataType === 'candidates') {
    csvContent += "Candidate ID,Name,Email,Job Applied,Status,Score,Registered On\n";
    AppState.candidates.forEach(c => {
      csvContent += `"${c.id}","${c.name}","${c.email}","${c.jobApplied}","${c.status}","${c.score}","${c.registeredOn}"\n`;
    });
    filename = "IntervieHire_candidates_export.csv";
  } else if (dataType === 'team') {
    csvContent += "Team Member,Email,Designation,Usertype,Registered On,Status\n";
    AppState.team.forEach(t => {
      csvContent += `"${t.name}","${t.email}","${t.designation}","${t.usertype}","${t.registeredOn}","${t.status}"\n`;
    });
    filename = "IntervieHire_team_export.csv";
  }

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ==========================================
// CREATIVE FEATURES ADDITIONAL LOGIC
// ==========================================

function recalculateJobPipelines() {
  AppState.jobs.forEach(job => {
    // Find all candidates for this job
    const jobCandidates = AppState.candidates.filter(c => c.jobApplied === job.roleName || c.jobApplied === job.cardName);
    
    job.pipeline.total = jobCandidates.length;
    job.pipeline.resume = jobCandidates.filter(c => c.status === 'Resume').length;
    job.pipeline.screening = jobCandidates.filter(c => c.status === 'Screening').length;
    job.pipeline.functional = jobCandidates.filter(c => c.status === 'Functional').length;
  });
}

function renderKanbanBoard() {
  const container = document.getElementById('jobs-board-container');
  if (!container) return;

  const cols = {
    Resume: document.getElementById('col-resume'),
    Screening: document.getElementById('col-screening'),
    Functional: document.getElementById('col-functional'),
    Hired: document.getElementById('col-hired')
  };

  // Reset columns
  Object.values(cols).forEach(col => {
    if (col) col.innerHTML = '';
  });

  const counts = { Resume: 0, Screening: 0, Functional: 0, Hired: 0 };
  const searchVal = AppState.globalSearch.toLowerCase();

  // Filter candidates
  const filteredCandidates = AppState.candidates.filter(c => {
    if (searchVal) {
      return c.name.toLowerCase().includes(searchVal) || c.jobApplied.toLowerCase().includes(searchVal);
    }
    return true;
  });

  filteredCandidates.forEach(c => {
    const stage = c.status; // e.g. 'Resume', 'Screening', 'Functional', 'Hired'
    if (!cols[stage]) return;

    counts[stage]++;

    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.setAttribute('draggable', 'true');
    
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', c.id);
      e.dataTransfer.effectAllowed = 'move';
    });
    
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
    
    const isHired = stage === 'Hired';
    
    card.innerHTML = `
      <div class="kanban-card-title">${c.name}</div>
      <div class="kanban-card-job">${c.jobApplied}</div>
      <div class="kanban-card-footer">
        <span class="kanban-card-score">${c.score}</span>
        ${isHired 
          ? `<span style="font-size: 0.72rem; color: var(--color-success); font-weight: 600;">✓ Hired</span>` 
          : `<button class="btn-advance-kanban" data-candidate-id="${c.id}">Advance →</button>`
        }
      </div>
    `;

    cols[stage].appendChild(card);
  });

  // Update counts in column headers
  document.getElementById('board-count-resume').textContent = counts.Resume;
  document.getElementById('board-count-screening').textContent = counts.Screening;
  document.getElementById('board-count-functional').textContent = counts.Functional;
  document.getElementById('board-count-hired').textContent = counts.Hired;

  // Bind click handlers to advance buttons
  container.querySelectorAll('.btn-advance-kanban').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const candId = btn.getAttribute('data-candidate-id');
      advanceCandidate(candId);
    });
  });
}

function advanceCandidate(candId) {
  const candidate = AppState.candidates.find(c => c.id === candId);
  if (!candidate) return;

  const currentStatus = candidate.status;
  let newStatus = currentStatus;

  if (currentStatus === 'Resume') {
    newStatus = 'Screening';
  } else if (currentStatus === 'Screening') {
    newStatus = 'Functional';
  } else if (currentStatus === 'Functional') {
    newStatus = 'Hired';
  }

  if (newStatus !== currentStatus) {
    candidate.status = newStatus;
    
    // Play sound chime
    soundEngine.playChime([329.63, 440.00, 523.25], 0.2, 0.08);
    
    // Recalculate and update views
    recalculateJobPipelines();
    updateSummaryMetrics();
    renderAnalyticsTable();
    
    if (document.getElementById('jobs-board-container').style.display !== 'none') {
      renderKanbanBoard();
    } else {
      renderJobCards();
    }
  }
}

// Swarm Terminal logging ticker simulation
let swarmLogsInterval = null;
const simulatedLogTemplates = [
  () => {
    if (AppState.candidates.length === 0) return `<code>[${new Date().toLocaleTimeString()}] Swarm:</code> Awaiting candidate records...`;
    const name = AppState.candidates[Math.floor(Math.random() * AppState.candidates.length)].name;
    return `<code>[${new Date().toLocaleTimeString()}] Lina:</code> Analysed resume profile for ${name}. Match index: ${(80 + Math.random()*19).toFixed(0)}%.`;
  },
  () => {
    if (AppState.candidates.length === 0) return `<code>[${new Date().toLocaleTimeString()}] Swarm:</code> Vetting pipeline inactive.`;
    const name = AppState.candidates[Math.floor(Math.random() * AppState.candidates.length)].name;
    return `<code>[${new Date().toLocaleTimeString()}] Kaelen:</code> Finished functional assessment evaluations for ${name}.`;
  },
  () => {
    if (AppState.candidates.length === 0) return `<code>[${new Date().toLocaleTimeString()}] Swarm:</code> Communications queue idle.`;
    const name = AppState.candidates[Math.floor(Math.random() * AppState.candidates.length)].name;
    return `<code>[${new Date().toLocaleTimeString()}] Lyra:</code> Dispatched automated onboarding checklist update to ${name}.`;
  },
  () => {
    const job = AppState.jobs[Math.floor(Math.random() * AppState.jobs.length)].roleName;
    return `<code>[${new Date().toLocaleTimeString()}] Lina:</code> Correlating candidates index for ${job}.`;
  },
  () => {
    return `<code>[${new Date().toLocaleTimeString()}] Kaelen:</code> Reviewing active test-suites and coverage reports. System green.`;
  },
  () => {
    return `<code>[${new Date().toLocaleTimeString()}] Lyra:</code> All scheduled recruiter screens synced to GCal successfully.`;
  }
];

function startSwarmLogs() {
  if (swarmLogsInterval) return;
  
  // Append initial ticker line
  appendTerminalLog(`<code>[${new Date().toLocaleTimeString()}] Swarm:</code> Connection handshake successful. Diagnostic ticker active.`);
  
  swarmLogsInterval = setInterval(() => {
    if (AppState.activeTab === 'swarm') {
      const log = simulatedLogTemplates[Math.floor(Math.random() * simulatedLogTemplates.length)]();
      appendTerminalLog(log);
    }
  }, 4000);
}

function appendTerminalLog(text, colorClass = '') {
  const termBody = document.getElementById('swarm-terminal-body');
  if (!termBody) return;
  const div = document.createElement('div');
  div.className = 'term-log' + (colorClass ? ' ' + colorClass : '');
  div.innerHTML = text;
  termBody.appendChild(div);
  termBody.scrollTop = termBody.scrollHeight;
}

function handleSwarmPrompt(promptText) {
  if (!promptText.trim()) return;
  
  const inputEl = document.getElementById('swarm-prompter');
  if (inputEl) inputEl.value = '';
  
  soundEngine.playClick();
  appendTerminalLog(`<code>[${new Date().toLocaleTimeString()}] User:</code> ${promptText}`, 'font-gold');
  
  const textLower = promptText.toLowerCase();
  let targetAgent = 'aria';
  let activeStatus = '';
  let finalStatus = '';
  let response = '';
  
  if (textLower.includes('kaelen') || textLower.includes('code') || textLower.includes('review') || textLower.includes('rubric')) {
    targetAgent = 'kaelen';
    response = `<code>[${new Date().toLocaleTimeString()}] Kaelen:</code> Completed source-level review audit. Identified 1 candidate matching standard repository test coverages.`;
    activeStatus = 'Reviewing code repository requests...';
    finalStatus = 'Vetting analysis reports complete.';
  } else if (textLower.includes('lyra') || textLower.includes('email') || textLower.includes('invite') || textLower.includes('send')) {
    targetAgent = 'lyra';
    response = `<code>[${new Date().toLocaleTimeString()}] Lyra:</code> Scanned queue. Dispatched invitation link templates to pending candidates list.`;
    activeStatus = 'Mailing screening reminders...';
    finalStatus = 'Communications queue synced successfully.';
  } else {
    targetAgent = 'aria';
    response = `<code>[${new Date().toLocaleTimeString()}] Lina:</code> Filtered database matches. Identified candidates within desired experience and role configurations.`;
    activeStatus = 'Searching database indices...';
    finalStatus = 'Resume search queries completed.';
  }
  
  // Visual pulse indicator & status updates
  const statusElement = document.getElementById(`${targetAgent}-status`);
  const agentCard = document.getElementById(`agent-${targetAgent}`);
  const pulseDot = agentCard ? agentCard.querySelector('.pulse-dot') : null;
  
  if (statusElement) statusElement.textContent = activeStatus;
  if (pulseDot) {
    pulseDot.className = 'pulse-dot orange';
  }
  
  setTimeout(() => {
    appendTerminalLog(response);
    if (statusElement) statusElement.textContent = finalStatus;
    if (pulseDot) {
      pulseDot.className = 'pulse-dot green';
    }
    soundEngine.playChime([392.00, 523.25, 659.25], 0.15, 0.1);
  }, 1500);
}

// Waveform interview snippet player simulation
let waveformInterval = null;
let waveformPlayTime = 0; // in milliseconds
const waveformDuration = 12000; // 12 seconds

function setupWaveformBars() {
  const container = document.getElementById('waveform-viz-bars');
  if (!container) return;
  container.innerHTML = '';
  
  for (let i = 0; i < 28; i++) {
    const bar = document.createElement('div');
    bar.className = 'wave-bar';
    const h = Math.floor(Math.random() * 80 + 10);
    bar.style.height = `${h}%`;
    container.appendChild(bar);
  }
}

function resetWaveformAudio() {
  if (waveformInterval) {
    clearInterval(waveformInterval);
    waveformInterval = null;
  }
  waveformPlayTime = 0;
  
  const timer = document.getElementById('waveform-timer');
  if (timer) timer.textContent = '0:00 / 0:12';
  
  const playBtn = document.getElementById('btn-play-wave');
  if (playBtn) {
    playBtn.querySelector('.play-svg').style.display = 'block';
    playBtn.querySelector('.pause-svg').style.display = 'none';
  }
  
  const bars = document.querySelectorAll('#waveform-viz-bars .wave-bar');
  bars.forEach(bar => bar.classList.remove('played'));
}

function toggleWaveformAudio() {
  const playBtn = document.getElementById('btn-play-wave');
  if (!playBtn) return;
  
  const isPlaying = waveformInterval !== null;
  
  if (isPlaying) {
    clearInterval(waveformInterval);
    waveformInterval = null;
    playBtn.querySelector('.play-svg').style.display = 'block';
    playBtn.querySelector('.pause-svg').style.display = 'none';
    soundEngine.playClick();
  } else {
    playBtn.querySelector('.play-svg').style.display = 'none';
    playBtn.querySelector('.pause-svg').style.display = 'block';
    soundEngine.playChime([440, 554.37], 0.1, 0.05);
    
    waveformInterval = setInterval(() => {
      waveformPlayTime += 100;
      if (waveformPlayTime >= waveformDuration) {
        resetWaveformAudio();
        soundEngine.playChime([523.25, 392], 0.15, 0.08);
        return;
      }
      
      const timer = document.getElementById('waveform-timer');
      if (timer) {
        const secs = Math.floor(waveformPlayTime / 1000);
        timer.textContent = `0:${secs.toString().padStart(2, '0')} / 0:12`;
      }
      
      const bars = document.querySelectorAll('#waveform-viz-bars .wave-bar');
      const progress = waveformPlayTime / waveformDuration;
      const activeIndex = Math.floor(progress * bars.length);
      
      bars.forEach((bar, idx) => {
        if (idx === activeIndex || (idx < activeIndex && Math.random() > 0.4)) {
          const h = Math.floor(Math.random() * 80 + 15);
          bar.style.height = `${h}%`;
        }
        
        if (idx <= activeIndex) {
          bar.classList.add('played');
        } else {
          bar.classList.remove('played');
        }
      });
    }, 100);
  }
}

const CandidateReviews = {
  'CAN-8234-EA1': {
    file: 'App.jsx (React)',
    code: `<span class="keyword">import</span> { useState, useEffect } <span class="keyword">from</span> <span class="string">'react'</span>;\n\n<span class="keyword">export default function</span> <span class="func">UserList</span>() {\n  <span class="keyword">const</span> [users, setUsers] = useState([]);\n  <span class="keyword">const</span> [loading, setLoading] = useState(<span class="keyword">true</span>);\n\n  useEffect(() =&gt; {\n    <span class="keyword">const</span> controller = <span class="keyword">new</span> <span class="class-name">AbortController</span>();\n    <span class="func">fetchUsers</span>(controller.signal);\n    <span class="keyword">return</span> () =&gt; controller.abort();\n  }, []);`,
    reviewer: 'Sarah J.',
    initials: 'SJ',
    comment: 'Excellent cleanup hook. Aditya handles asynchronous API mounts using the correct React AbortController pattern. Prevents race conditions and memory leaks.'
  },
  'CAN-7128-DF5': {
    file: 'tender_process.go (Golang)',
    code: `<span class="keyword">package</span> main\n\n<span class="keyword">import</span> (\n  <span class="string">"context"</span>\n  <span class="string">"time"</span>\n)\n\n<span class="keyword">func</span> <span class="func">ProcessTender</span>(ctx context.Context, id <span class="keyword">string</span>) <span class="keyword">error</span> {\n  ctx, cancel := context.WithTimeout(ctx, 5*time.Second)\n  <span class="keyword">defer</span> cancel()\n  \n  <span class="keyword">return</span> <span class="func">FetchTenderDetails</span>(ctx, id)\n}`,
    reviewer: 'Sarah J.',
    initials: 'SJ',
    comment: 'Devasri has structured this scraper with clean worker pools and context timeouts. Excellent handling of HTTP request parameters.'
  },
  'CAN-3401-EA1': {
    file: 'HomeLayout.css (CSS3)',
    code: `<span class="keyword">.grid-container</span> {\n  <span class="keyword">display</span>: grid;\n  <span class="keyword">grid-template-columns</span>: repeat(auto-fit, minmax(280px, 1fr));\n  <span class="keyword">gap</span>: 1.5rem;\n  <span class="keyword">padding</span>: 2rem;\n  <span class="keyword">background-color</span>: <span class="string">var(--color-bg)</span>;\n}`,
    reviewer: 'Sarah J.',
    initials: 'SJ',
    comment: 'Ines uses modern semantic CSS grid and variables. Clean, legible code structure.'
  },
  'CAN-9012-EA2': {
    file: 'auth_helper.py (Python)',
    code: `<span class="keyword">import</span> jwt\n<span class="keyword">from</span> datetime <span class="keyword">import</span> datetime, timedelta\n\n<span class="keyword">def</span> <span class="func">create_token</span>(user_id: str) -&gt; str:\n  payload = {\n    <span class="string">'sub'</span>: user_id,\n    <span class="string">'exp'</span>: datetime.utcnow() + timedelta(days=1)\n  }\n  <span class="keyword">return</span> jwt.encode(payload, <span class="string">'SECRET_KEY'</span>, algorithm=<span class="string">'HS256'</span>)`,
    reviewer: 'Sarah J.',
    initials: 'SJ',
    comment: 'Sarah uses robust encryption packages. Recommended addition of rate limit headers.'
  }
};

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

// ==========================================
// JOB DETAIL VIEW
// ==========================================

function navigateToJobDetail(jobId) {
  const job = AppState.jobs.find(j => j.id === jobId);
  if (!job) return;

  AppState.activeJobId = jobId;
  AppState.activeTab = 'job-detail';

  // Sidebar: keep Jobs highlighted as parent
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-tab') === 'jobs');
  });
  document.querySelectorAll('.sub-nav li').forEach(li => li.classList.remove('active-sub'));

  // Breadcrumb — "Jobs" clickable link
  const breadcrumb = document.getElementById('breadcrumb-title');
  const shortName = job.cardName.length > 30 ? job.cardName.slice(0, 30) + '…' : job.cardName;
  breadcrumb.innerHTML = `<span class="breadcrumb-link" id="bc-jobs-link">Jobs</span>
    <span class="breadcrumb-separator">/</span> ${shortName}
    <span class="breadcrumb-separator">/</span> Responses`;
  document.getElementById('bc-jobs-link').addEventListener('click', () => navigateToTab('jobs'));

  // Header
  document.getElementById('header-main-title').textContent = job.cardName;
  document.getElementById('header-sub-text').textContent =
    `${job.pipeline.total} total candidate${job.pipeline.total !== 1 ? 's' : ''} · ${job.roleName}`;
  document.getElementById('header-action-btn').style.display = 'none';

  // Show view
  document.querySelectorAll('.dashboard-view').forEach(v => v.classList.remove('active-view'));
  document.getElementById('view-job-detail').classList.add('active-view');

  // Sub-tab counts
  document.getElementById('jd-count-screening').textContent = job.pipeline.screening;
  document.getElementById('jd-count-functional').textContent = job.pipeline.functional;

  // Reset to Overview tab
  document.querySelectorAll('.jd-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.jd-tab[data-jd-tab="overview"]').classList.add('active');
  document.querySelectorAll('.jd-pane').forEach(p => p.classList.remove('active'));
  document.getElementById('jd-pane-overview').classList.add('active');

  const jobCandidates = AppState.candidates.filter(
    c => c.jobApplied === job.roleName || c.jobApplied === job.cardName
  );

  renderFunnelStages(job);
  renderFunnelInsights(job);
  renderJobDetailPanes(job);

  // SVG needs layout to be painted first
  requestAnimationFrame(() => {
    drawFunnelSVG(job, jobCandidates);
    drawScoreDistributionSVG(job, jobCandidates);
  });

  soundEngine.playChime([440.00, 523.25, 659.25], 0.12, 0.08);
}

function renderFunnelStages(job) {
  const container = document.getElementById('jd-funnel-stages');
  if (!container) return;

  const total = Math.max(job.pipeline.total, 1);
  const completed = job.pipeline.functional > 0 ? 1 : 0;

  const stages = [
    { count: job.pipeline.total, label: 'Total Candidates', conv: null },
    { count: job.pipeline.resume,     label: 'Resume Analysis',      conv: Math.round((job.pipeline.resume / total) * 100) },
    { count: job.pipeline.screening,  label: 'Recruiter Screening',  conv: Math.round((job.pipeline.screening / total) * 100) },
    { count: job.pipeline.functional, label: 'Functional Interview', conv: Math.round((job.pipeline.functional / total) * 100) },
    { count: completed,               label: 'Completed',            conv: Math.round((completed / total) * 100) },
    { count: completed,               label: 'Qualified',            conv: Math.round((completed / total) * 100) },
  ];

  container.innerHTML = stages.map(s => `
    <div class="jd-stage-item">
      <div class="jds-count">${s.count}</div>
      <div class="jds-label">${s.label}</div>
      ${s.conv !== null ? `<div class="jds-conv">${s.conv}%</div>` : ''}
    </div>
  `).join('');
}

function renderFunnelInsights(job) {
  const container = document.getElementById('jd-insights-body');
  if (!container) return;

  const total = job.pipeline.total;
  const screening = job.pipeline.screening;
  const functional = job.pipeline.functional;
  const insights = [];

  if (total === 0) {
    insights.push({ type: 'info', text: 'No candidates yet. Share interview links to start receiving applications.' });
  } else {
    const screeningPct = Math.round((screening / total) * 100);
    if (job.pipeline.resume === 0) {
      insights.push({ type: 'warn', text: 'Resume Analysis stage has 0 candidates — consider enabling resume screening in job settings.' });
    }
    if (screeningPct >= 50) {
      insights.push({ type: 'good', text: `Strong ${screeningPct}% conversion to Recruiter Screening — pipeline quality is high.` });
    }
    if (functional > 0) {
      insights.push({ type: 'good', text: `${functional} candidate${functional > 1 ? 's' : ''} reached Functional Interview and ${functional === 1 ? 'is' : 'are'} ready for expert vetting.` });
    } else if (screening > 0) {
      insights.push({ type: 'info', text: 'No candidates have advanced to Functional Interview yet. Recruiter screening is in progress.' });
    }
  }

  if (insights.length === 0) {
    insights.push({ type: 'info', text: 'Funnel data looks healthy. Continue monitoring candidate progress.' });
  }

  container.innerHTML = insights.map(ins => `
    <div class="jd-insight-item ${ins.type}">
      <span class="jd-insight-dot"></span>
      <p>${ins.text}</p>
    </div>
  `).join('');
}

function drawFunnelSVG(job, candidates) {
  const svgEl = document.getElementById('jd-funnel-svg');
  if (!svgEl) return;

  const W = 460, H = 400;
  const cx = W / 2;
  const maxHW = 148;
  const padT = 10, padB = 10;

  const total = Math.max(job.pipeline.total, 1);
  const completed = job.pipeline.functional > 0 ? 1 : 0;

  const stageCounts = [
    job.pipeline.total,
    job.pipeline.resume || 0,
    job.pipeline.screening || 0,
    job.pipeline.functional || 0,
    completed,
    completed,
  ];
  const n = stageCounts.length;
  const ys = stageCounts.map((_, i) => padT + (i / (n - 1)) * (H - padT - padB));

  const hws = stageCounts.map((c, i) => {
    if (i === 0) return maxHW;
    if (c === 0) return 3;
    return Math.max((c / total) * maxHW, 9);
  });

  // Pink (Scheduled) fraction — proportional to screening candidates
  const pinkFrac = Math.max(Math.min(job.pipeline.screening / total, 0.85), 0.15) || 0.6;

  const pts = stageCounts.map((_, i) => ({
    y: ys[i],
    lx: cx - hws[i],
    rx: cx + hws[i],
    mx: cx - hws[i] + (2 * hws[i] * pinkFrac),
  }));

  const pinkSegs = [], greenSegs = [];
  for (let i = 0; i < n - 1; i++) {
    const p = pts[i], q = pts[i + 1];
    const midY = (p.y + q.y) / 2;

    pinkSegs.push(
      `M ${p.lx} ${p.y} L ${p.mx} ${p.y}` +
      ` C ${p.mx} ${midY} ${q.mx} ${midY} ${q.mx} ${q.y}` +
      ` L ${q.lx} ${q.y}` +
      ` C ${q.lx} ${midY} ${p.lx} ${midY} ${p.lx} ${p.y} Z`
    );
    greenSegs.push(
      `M ${p.mx} ${p.y} L ${p.rx} ${p.y}` +
      ` C ${p.rx} ${midY} ${q.rx} ${midY} ${q.rx} ${q.y}` +
      ` L ${q.mx} ${q.y}` +
      ` C ${q.mx} ${midY} ${p.mx} ${midY} ${p.mx} ${p.y} Z`
    );
  }

  const isLight = document.body.classList.contains('light-theme');
  const dividerStroke = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.065)';
  
  // Clean solid flat colors configured separately for light and dark themes
  const pinkFill = isLight ? '#be185d' : '#ec4899';   // Deep rose for light, vibrant pink for dark
  const greenFill = isLight ? '#047857' : '#10b981';  // Forest green for light, vibrant emerald for dark

  const dividers = pts.slice(1, -1).map(p =>
    `<line x1="${p.lx - 14}" y1="${p.y}" x2="${p.rx + 14}" y2="${p.y}"
      stroke="${dividerStroke}" stroke-width="1" stroke-dasharray="4 3"/>`
  ).join('');

  svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svgEl.innerHTML = `
    ${dividers}
    ${pinkSegs.map(d => `<path d="${d}" fill="${pinkFill}" opacity="0.9"/>`).join('')}
    ${greenSegs.map(d => `<path d="${d}" fill="${greenFill}" opacity="0.9"/>`).join('')}
  `;
}

function drawScoreDistributionSVG(job, candidates) {
  const svgEl = document.getElementById('jd-score-svg');
  if (!svgEl) return;

  const buckets = ['0-20', '20-40', '40-60', '60-80', '80-100'];
  const counts = [0, 0, 0, 0, 0];

  candidates.forEach(c => {
    const s = parseFloat(c.score);
    if (s < 20) counts[0]++;
    else if (s < 40) counts[1]++;
    else if (s < 60) counts[2]++;
    else if (s < 80) counts[3]++;
    else counts[4]++;
  });

  const totalC = Math.max(candidates.length, 1);
  const percs = counts.map(c => (c / totalC) * 100);

  const W = 380, H = 195;
  const padL = 42, padR = 12, padT = 18, padB = 36;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const barW = (chartW / buckets.length) * 0.52;
  const gap = chartW / buckets.length;

  const isLight = document.body.classList.contains('light-theme');
  const gridStroke = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.045)';
  const labelFill = isLight ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.3)';
  const valFill = isLight ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.65)';
  const bucketFill = isLight ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.35)';
  const barFill = isLight ? '#4f46e5' : '#6366f1';

  const yTicks = [0, 25, 50, 75, 100];
  const yLines = yTicks.map(v => {
    const y = padT + chartH - (v / 100) * chartH;
    return `
      <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"
        stroke="${gridStroke}" stroke-width="1"/>
      <text x="${padL - 6}" y="${y + 3.5}" text-anchor="end"
        fill="${labelFill}" font-size="9" font-family="sans-serif">${v}%</text>`;
  }).join('');

  const bars = percs.map((p, i) => {
    const barH = Math.max((p / 100) * chartH, p > 0 ? 2 : 0);
    const x = padL + i * gap + (gap - barW) / 2;
    const y = padT + chartH - barH;
    return `
      <rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${barFill}" rx="3" opacity="0.9"/>
      ${p > 0 ? `<text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle"
        fill="${valFill}" font-size="9.5" font-family="sans-serif">${Math.round(p)}%</text>` : ''}
      <text x="${x + barW / 2}" y="${H - padB + 14}" text-anchor="middle"
        fill="${bucketFill}" font-size="9" font-family="sans-serif">${buckets[i]}</text>`;
  }).join('');

  svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svgEl.innerHTML = yLines + bars;
}

// Spotlight shortcuts CMD+K modal logic
let selectedCommandIndex = 0;
const SpotlightCommands = [
  { name: 'Switch to Jobs View', desc: 'Navigate to jobs listings and pipeline', action: () => navigateToTab('jobs'), shortcut: 'Alt+1' },
  { name: 'View Usage Overview', desc: 'Track funnel metrics and analytics tables', action: () => navigateToTab('analytics'), shortcut: 'Alt+2' },
  { name: 'Switch to AI Swarm Console', desc: 'Open autonomous agent swarm terminal', action: () => navigateToTab('swarm'), shortcut: 'Alt+3' },
  { name: 'View Team Access Logs', desc: 'Manage team invites, roles, and security', action: () => navigateToTab('team'), shortcut: 'Alt+4' },
  { name: 'Configure Career Subdomain', desc: 'Update public career subdomain configurations', action: () => navigateToTab('career'), shortcut: 'Alt+5' },
  { name: 'Open Job Creator Drawer', desc: 'Create a new recruitment pipeline job card', action: () => openDrawer('job'), shortcut: 'Alt+N' },
  { name: 'Open Invitation Drawer', desc: 'Invite a new team member or manager', action: () => openDrawer('member'), shortcut: 'Alt+I' },
  { name: 'Change Security Settings', desc: 'Change password credential settings', action: () => navigateToSubtab('settings-password'), shortcut: 'Alt+P' },
  { name: 'Cookie Settings', desc: 'Manage session privacy cookie settings', action: () => navigateToSubtab('settings-cookies'), shortcut: 'Alt+C' }
];

function toggleSpotlightModal(show) {
  const modal = document.getElementById('spotlight-modal');
  if (!modal) return;
  
  if (show) {
    modal.classList.add('active');
    const input = document.getElementById('spotlight-input');
    if (input) {
      input.value = '';
      input.focus();
    }
    selectedCommandIndex = 0;
    renderSpotlightResults();
    soundEngine.playClick();
  } else {
    modal.classList.remove('active');
  }
}

function renderSpotlightResults() {
  const listContainer = document.getElementById('spotlight-results-list');
  if (!listContainer) return;
  
  const input = document.getElementById('spotlight-input');
  const query = input ? input.value.toLowerCase().trim() : '';
  listContainer.innerHTML = '';
  
  const filtered = SpotlightCommands.filter(cmd => {
    return cmd.name.toLowerCase().includes(query) || cmd.desc.toLowerCase().includes(query);
  });
  
  if (filtered.length === 0) {
    listContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--color-text-muted); font-size: 0.85rem;">No command shortcuts match your query</div>`;
    return;
  }
  
  if (selectedCommandIndex >= filtered.length) {
    selectedCommandIndex = filtered.length - 1;
  }
  if (selectedCommandIndex < 0) {
    selectedCommandIndex = 0;
  }
  
  filtered.forEach((cmd, idx) => {
    const item = document.createElement('div');
    const isSelected = idx === selectedCommandIndex;
    item.className = 'spotlight-item' + (isSelected ? ' selected' : '');
    
    let iconSvg = '';
    if (cmd.name.includes('Jobs') || cmd.name.includes('Job')) {
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`;
    } else if (cmd.name.includes('Usage') || cmd.name.includes('Overview')) {
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`;
    } else if (cmd.name.includes('Swarm')) {
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="10" r="2"></circle><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect></svg>`;
    } else if (cmd.name.includes('Team') || cmd.name.includes('Invite')) {
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>`;
    } else {
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
    }
    
    item.innerHTML = `
      <div class="item-left">
        ${iconSvg}
        <span class="cmd-name">${cmd.name}</span>
        <span class="cmd-desc">${cmd.desc}</span>
      </div>
      <span class="cmd-shortcut"><kbd>${cmd.shortcut}</kbd></span>
    `;
    
    item.addEventListener('click', () => {
      toggleSpotlightModal(false);
      cmd.action();
    });
    
    listContainer.appendChild(item);
  });
}

// Global window key listeners for shortcuts
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    const modal = document.getElementById('spotlight-modal');
    const isActive = modal ? modal.classList.contains('active') : false;
    toggleSpotlightModal(!isActive);
  }
  
  if (e.key === 'Escape') {
    const modal = document.getElementById('spotlight-modal');
    if (modal && modal.classList.contains('active')) {
      toggleSpotlightModal(false);
    } else {
      closeDrawers();
    }
  }
  
  if (e.altKey) {
    if (e.key === '1') { e.preventDefault(); navigateToTab('jobs'); }
    else if (e.key === '2') { e.preventDefault(); navigateToTab('analytics'); }
    else if (e.key === '3') { e.preventDefault(); navigateToTab('swarm'); }
    else if (e.key === '4') { e.preventDefault(); navigateToTab('team'); }
    else if (e.key === '5') { e.preventDefault(); navigateToTab('career'); }
    else if (e.key.toLowerCase() === 'n') { e.preventDefault(); openDrawer('job'); }
    else if (e.key.toLowerCase() === 'i') { e.preventDefault(); openDrawer('member'); }
    else if (e.key.toLowerCase() === 'p') { e.preventDefault(); navigateToSubtab('settings-password'); }
    else if (e.key.toLowerCase() === 'c') { e.preventDefault(); navigateToSubtab('settings-cookies'); }
  }
});

// ==========================================
// COMPONENT MOUNT BINDINGS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Load state from localStorage on startup
  loadStateFromLocalStorage();

  // Sidebar Collapse Toggle
  const toggleSidebarBtn = document.getElementById('btn-toggle-sidebar');
  if (toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener('click', () => {
      const appContainer = document.querySelector('.dashboard-app');
      if (appContainer) {
        appContainer.classList.toggle('sidebar-collapsed');
        soundEngine.playClick();
      }
    });
  }

  // Recalculate job pipelines based on initial state
  recalculateJobPipelines();

  // A. Navigation Event Listeners
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const tabId = item.getAttribute('data-tab');
      
      // If clicking settings, toggle subnav but don't navigate directly unless subnav is clicked
      if (tabId === 'settings') {
        e.stopPropagation();
        item.classList.toggle('open');
        soundEngine.playClick();
        return;
      }
      
      navigateToTab(tabId);
    });
  });

  // Settings subnav clicks
  document.querySelectorAll('.sub-nav li').forEach(subItem => {
    subItem.addEventListener('click', (e) => {
      e.stopPropagation();
      const subtabId = subItem.getAttribute('data-subtab');
      navigateToSubtab(subtabId);
    });
  });

  // B. Contextual Action Button (Header)
  const headerActionBtn = document.getElementById('header-action-btn');
  headerActionBtn.addEventListener('click', () => {
    if (AppState.activeTab === 'team') {
      openDrawer('member');
    } else {
      navigateToCreateJob();
    }
  });

  // C. Drawer Close actions
  document.getElementById('drawer-backdrop').addEventListener('click', closeDrawers);
  document.getElementById('btn-close-drawer-job').addEventListener('click', closeDrawers);
  document.getElementById('btn-close-drawer-member').addEventListener('click', closeDrawers);
  document.getElementById('btn-close-drawer-view-jd').addEventListener('click', closeDrawers);
  
  document.getElementById('btn-save-drawer-jd').addEventListener('click', () => {
    const drawer = document.getElementById('drawer-view-jd');
    const jobId = drawer.getAttribute('data-current-job-id');
    const descriptionText = document.getElementById('drawer-jd-text').value.trim();
    if (jobId) {
      const job = AppState.jobs.find(j => j.id === jobId);
      if (job) {
        job.description = descriptionText;
        showPremiumToast("Job description updated successfully.", "success");
        saveStateToLocalStorage();
        if (AppState.activeJobId === jobId) {
          const jdRawDescTextarea = document.getElementById('jd-raw-description');
          if (jdRawDescTextarea) {
            jdRawDescTextarea.value = descriptionText;
          }
        }
      }
    }
    closeDrawers();
  });

  // JD Drawer: Enhance description with DeepSeek
  const btnEnhanceDrawerJd = document.getElementById('btn-enhance-drawer-jd');
  if (btnEnhanceDrawerJd) {
    btnEnhanceDrawerJd.addEventListener('click', async () => {
      const drawer = document.getElementById('drawer-view-jd');
      const textarea = document.getElementById('drawer-jd-text');
      const currentText = textarea ? textarea.value.trim() : '';
      if (!currentText) {
        showPremiumToast("Please enter a job description first.", "error");
        return;
      }

      const originalLabel = btnEnhanceDrawerJd.textContent;
      btnEnhanceDrawerJd.disabled = true;
      btnEnhanceDrawerJd.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin-mini 0.6s linear infinite;margin-right:5px;vertical-align:middle;"></span> Enhancing...`;

      soundEngine.playChime([392, 440], 0.08, 0.1);

      const systemPrompt = `You are a senior talent acquisition specialist. Rewrite the given job description to be clearer, more compelling, and professional. Keep all the original requirements but improve the structure, language, and readability. Return ONLY the improved job description text — no commentary, no JSON, no markdown headers.`;

      try {
        const improved = await callDeepSeekAPI([
          { role: "system", content: systemPrompt },
          { role: "user", content: `Improve this job description:\n\n${currentText}` }
        ]);
        if (textarea) textarea.value = improved.trim();
        soundEngine.playChime([523.25, 659.25], 0.12, 0.08);
        showPremiumToast("Job description enhanced successfully.", "success");
      } catch (err) {
        console.error("JD enhancement failed:", err);
        showPremiumToast("Enhancement failed. Check API status.", "error");
      } finally {
        btnEnhanceDrawerJd.disabled = false;
        btnEnhanceDrawerJd.textContent = originalLabel;
      }
    });
  }

  // JD Drawer: Save + navigate to Questions tab and trigger generation
  const btnGenerateFromDrawer = document.getElementById('btn-generate-from-drawer-jd');
  if (btnGenerateFromDrawer) {
    btnGenerateFromDrawer.addEventListener('click', () => {
      const drawer = document.getElementById('drawer-view-jd');
      const jobId = drawer.getAttribute('data-current-job-id');
      const descriptionText = document.getElementById('drawer-jd-text').value.trim();
      if (!jobId || !descriptionText) {
        showPremiumToast("Add a job description before generating questions.", "error");
        return;
      }
      const job = AppState.jobs.find(j => j.id === jobId);
      if (job) {
        job.description = descriptionText;
        saveStateToLocalStorage();
      }
      closeDrawers();
      navigateToJobDetail(jobId);
      // Switch to Questions tab after navigation paint
      requestAnimationFrame(() => {
        const questionsTab = document.querySelector('.jd-tab[data-jd-tab="questions"]');
        if (questionsTab) questionsTab.click();
        // Pre-fill the description textarea in the Questions pane
        const rawDesc = document.getElementById('jd-raw-description');
        if (rawDesc) rawDesc.value = descriptionText;
        soundEngine.playChime([329.63, 392, 523.25], 0.12, 0.1);
      });
    });
  }

  window.openJobDescriptionDrawer = (jobId) => openDrawer('view-jd', jobId);
  
  const closeReportBtn = document.getElementById('btn-close-drawer-report');
  if (closeReportBtn) {
    closeReportBtn.addEventListener('click', closeDrawers);
  }

  // Report Vetting Drawer tab switching
  document.querySelectorAll('.report-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-report-tab');
      
      document.querySelectorAll('.report-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      document.querySelectorAll('.report-tab-content').forEach(c => c.classList.remove('active'));
      const activeContent = document.getElementById(`rep-tab-${tabName}`);
      if (activeContent) activeContent.classList.add('active');
      
      soundEngine.playClick();
    });
  });

  // Interview Waveform playback control
  const btnPlayWave = document.getElementById('btn-play-wave');
  if (btnPlayWave) {
    btnPlayWave.addEventListener('click', () => {
      toggleWaveformAudio();
    });
  }

  // D. Job Filter Buttons (Jobs list header)
  document.querySelectorAll('.filter-options button[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-options button[data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.jobsFilter = btn.getAttribute('data-filter');
      soundEngine.playClick();
      
      const isBoard = document.getElementById('btn-view-board').classList.contains('active');
      if (isBoard) {
        renderKanbanBoard();
      } else {
        renderJobCards();
      }
    });
  });

  // E. Team Filter Buttons (Team list header)
  document.querySelectorAll('#team-status-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#team-status-tabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.teamFilter = btn.getAttribute('data-team-filter');
      soundEngine.playClick();
      renderTeamTable();
    });
  });

  // F. Table Switcher Subtabs (Analytics View)
  document.querySelectorAll('.table-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.table-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.analyticsSubtab = btn.getAttribute('data-table');
      soundEngine.playClick();
      renderAnalyticsTable();
    });
  });

  // G. Dynamic searching filters
  const globalSearchInput = document.getElementById('global-search');
  globalSearchInput.addEventListener('input', (e) => {
    AppState.globalSearch = e.target.value;
    if (AppState.activeTab === 'jobs') {
      const isBoard = document.getElementById('btn-view-board').classList.contains('active');
      if (isBoard) {
        renderKanbanBoard();
      } else {
        renderJobCards();
      }
    } else if (AppState.activeTab === 'analytics') {
      AppState.tableSearch = e.target.value;
      renderAnalyticsTable();
    } else if (AppState.activeTab === 'team') {
      renderTeamTable();
    }
  });

  const tableSearchInput = document.getElementById('table-search');
  tableSearchInput.addEventListener('input', (e) => {
    AppState.tableSearch = e.target.value;
    renderAnalyticsTable();
  });

  const teamSearchInput = document.getElementById('team-search');
  teamSearchInput.addEventListener('input', () => {
    renderTeamTable();
  });

  const teamRoleFilter = document.getElementById('team-role-filter');
  teamRoleFilter.addEventListener('change', () => {
    soundEngine.playClick();
    renderTeamTable();
  });

  // H. Forms submit action handlers
  // 1. Create Job Card Submission
  const createJobForm = document.getElementById('form-create-job');
  if (createJobForm) {
    createJobForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const cardName = document.getElementById('job-title-input').value;
      const roleName = document.getElementById('job-role-input').value;
      const expBand = document.getElementById('job-experience-input').value;
      let customId = document.getElementById('job-custom-id').value;
      const description = document.getElementById('job-description-input').value.trim();
      
      if (!customId || customId.trim() === '') {
        customId = '-';
      }

      // Pipeline stages counts
      const addResume = document.getElementById('chk-resume').checked;
      const addScreening = document.getElementById('chk-screening').checked;
      const addFunctional = document.getElementById('chk-functional').checked;

      let totalApplicants = 0;
      let resumeVal = 0;
      let screeningVal = 0;
      let functionalVal = 0;

      // Simulate mock applicant distribution and push records
      const firstNames = ['Lucas', 'Sofia', 'Marcus', 'Chloe', 'Daniel', 'Amina'];
      const lastNames = ['Chen', 'Silva', 'Taylor', 'Nakamura', 'Oki', 'Ali'];
      
      const createMockCandidate = (status) => {
        const name = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
        const email = `${name.toLowerCase().replace(' ', '.')}@recruit.io`;
        const id = `CAN-${Math.floor(Math.random() * 8999 + 1000)}-${customId !== '-' ? customId.slice(-3) : generateJobId().slice(-3)}`;
        const scoreVal = Math.floor(Math.random() * 15 + 80) + '%';
        
        AppState.candidates.push({
          id,
          name,
          email,
          jobApplied: roleName,
          status,
          score: scoreVal,
          registeredOn: new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) + ', 10:00 AM'
        });
      };

      if (addResume) {
        createMockCandidate('Resume');
        resumeVal++;
        totalApplicants++;
      }
      if (addScreening) {
        createMockCandidate('Screening');
        createMockCandidate('Screening');
        screeningVal += 2;
        totalApplicants += 2;
      }
      if (addFunctional) {
        createMockCandidate('Functional');
        functionalVal++;
        totalApplicants++;
      }

      const newJob = {
        id: generateJobId(),
        roleName: roleName,
        cardName: cardName,
        created: new Date().toLocaleString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
        status: 'published',
        customJobId: customId,
        experienceBand: expBand,
        createdBy: 'Devasri',
        description: description || "No job description provided.",
        questions: [],
        pipeline: {
          total: totalApplicants,
          resume: resumeVal,
          screening: screeningVal,
          functional: functionalVal
        }
      };

      AppState.jobs.push(newJob);

      // Refresh display
      const isBoard = document.getElementById('btn-view-board').classList.contains('active');
      if (isBoard) {
        renderKanbanBoard();
      } else {
        renderJobCards();
      }
      updateSummaryMetrics();
      renderAnalyticsTable();
      
      // Close Drawer panel
      closeDrawers();
      createJobForm.reset();
      soundEngine.playChime([261.63, 392.00, 523.25], 0.2, 0.08); // Melodic confirmation chime
    });
  }

  // 2. Invite Team Member Submission
  const inviteMemberForm = document.getElementById('form-invite-member');
  inviteMemberForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('member-name-input').value;
    const email = document.getElementById('member-email-input').value;
    const designation = document.getElementById('member-designation-input').value;
    const usertype = document.getElementById('member-role-input').value;

    const newMember = {
      name: name,
      email: email,
      designation: designation,
      usertype: usertype,
      registeredOn: new Date().toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
      status: 'Invited'
    };

    AppState.team.push(newMember);

    // Refresh display
    renderTeamTable();

    // Close Drawer panel
    closeDrawers();
    inviteMemberForm.reset();
    soundEngine.playChime([261.63, 392.00, 523.25], 0.2, 0.08); // Confirmation chime
  });

  // 3. Settings Forms (Mock updates with inline alerts)
  document.getElementById('career-settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    soundEngine.playChime([523.25], 0.15);
    const domainName = document.getElementById('career-subdomain').value;
    const statusLink = document.querySelector('.status-link');
    statusLink.textContent = `IntervieHire.com/careers/${domainName} ↗`;
    statusLink.href = `https://IntervieHire.com/careers/${domainName}`;
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const origText = submitBtn.textContent;
    submitBtn.textContent = '✓ Saved Settings!';
    submitBtn.style.background = 'var(--color-success)';
    submitBtn.style.color = '#fff';
    setTimeout(() => {
      submitBtn.textContent = origText;
      submitBtn.style.background = '';
      submitBtn.style.color = '';
    }, 2000);
  });

  document.getElementById('password-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const newPass = document.getElementById('new-pass').value;
    const confirmPass = document.getElementById('confirm-pass').value;
    const alertBox = document.getElementById('pass-success');

    if (newPass !== confirmPass) {
      alertBox.textContent = '❌ Passwords do not match!';
      alertBox.style.color = 'var(--color-orange)';
      alertBox.style.display = 'block';
      return;
    }

    soundEngine.playChime([523.25], 0.15);
    alertBox.textContent = '✓ Password updated successfully!';
    alertBox.style.color = 'var(--color-success)';
    alertBox.style.display = 'block';
    e.target.reset();
    setTimeout(() => {
      alertBox.style.display = 'none';
    }, 3000);
  });

  document.getElementById('cookies-form').addEventListener('submit', (e) => {
    e.preventDefault();
    soundEngine.playChime([523.25], 0.15);
    const alertBox = document.getElementById('cookies-success');
    alertBox.textContent = '✓ Cookie tracking profiles saved!';
    alertBox.style.display = 'block';
    setTimeout(() => {
      alertBox.style.display = 'none';
    }, 3000);
  });

  // I. Exports Buttons Bindings
  document.getElementById('btn-export-jobs').addEventListener('click', () => {
    if (AppState.analyticsSubtab === 'jobs-data') {
      triggerExcelExport('jobs');
    } else {
      triggerExcelExport('candidates');
    }
  });

  document.getElementById('btn-export-team').addEventListener('click', () => {
    triggerExcelExport('team');
  });

  // Columns toggles buttons actions
  document.getElementById('btn-columns-toggle').addEventListener('click', (e) => {
    e.stopPropagation();
    soundEngine.playClick();
    const pop = document.getElementById('pop-columns-toggle');
    const isShowing = pop.style.display !== 'none';
    
    // Close other
    const popTeam = document.getElementById('pop-columns-team');
    if (popTeam) popTeam.style.display = 'none';
    
    if (isShowing) {
      pop.style.display = 'none';
    } else {
      renderColumnsSelectorDropdowns();
      pop.style.display = 'flex';
    }
  });
  document.getElementById('btn-columns-team').addEventListener('click', (e) => {
    e.stopPropagation();
    soundEngine.playClick();
    const pop = document.getElementById('pop-columns-team');
    const isShowing = pop.style.display !== 'none';
    
    // Close other
    const popToggle = document.getElementById('pop-columns-toggle');
    if (popToggle) popToggle.style.display = 'none';
    
    if (isShowing) {
      pop.style.display = 'none';
    } else {
      renderColumnsSelectorDropdowns();
      pop.style.display = 'flex';
    }
  });

  // Global click outside to hide column popups
  document.addEventListener('click', () => {
    const popToggle = document.getElementById('pop-columns-toggle');
    const popTeam = document.getElementById('pop-columns-team');
    if (popToggle) popToggle.style.display = 'none';
    if (popTeam) popTeam.style.display = 'none';
  });

  // Kanban view switching setup
  const btnViewCards = document.getElementById('btn-view-cards');
  const btnViewBoard = document.getElementById('btn-view-board');
  const jobsListContainer = document.getElementById('jobs-list-container');
  const jobsBoardContainer = document.getElementById('jobs-board-container');

  if (btnViewCards && btnViewBoard) {
    btnViewCards.addEventListener('click', () => {
      btnViewCards.classList.add('active');
      btnViewBoard.classList.remove('active');
      jobsListContainer.style.display = 'grid';
      jobsBoardContainer.style.display = 'none';
      soundEngine.playClick();
      renderJobCards();
    });

    btnViewBoard.addEventListener('click', () => {
      btnViewBoard.classList.add('active');
      btnViewCards.classList.remove('active');
      jobsListContainer.style.display = 'none';
      jobsBoardContainer.style.display = 'grid';
      soundEngine.playClick();
      renderKanbanBoard();
    });
  }

  // Spotlight input key bindings
  const spotlightInput = document.getElementById('spotlight-input');
  if (spotlightInput) {
    spotlightInput.addEventListener('keydown', (e) => {
      const query = spotlightInput.value.toLowerCase().trim();
      const filtered = SpotlightCommands.filter(cmd => {
        return cmd.name.toLowerCase().includes(query) || cmd.desc.toLowerCase().includes(query);
      });

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filtered.length > 0) {
          selectedCommandIndex = (selectedCommandIndex + 1) % filtered.length;
          renderSpotlightResults();
          soundEngine.playClick();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filtered.length > 0) {
          selectedCommandIndex = (selectedCommandIndex - 1 + filtered.length) % filtered.length;
          renderSpotlightResults();
          soundEngine.playClick();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered.length > 0 && selectedCommandIndex < filtered.length) {
          const targetCmd = filtered[selectedCommandIndex];
          toggleSpotlightModal(false);
          targetCmd.action();
        }
      }
    });

    spotlightInput.addEventListener('input', () => {
      selectedCommandIndex = 0;
      renderSpotlightResults();
    });
  }

  const spotlightModal = document.getElementById('spotlight-modal');
  if (spotlightModal) {
    spotlightModal.addEventListener('click', (e) => {
      if (e.target === spotlightModal) {
        toggleSpotlightModal(false);
      }
    });
  }

  // AI Swarm Prompter bindings
  const swarmPrompter = document.getElementById('swarm-prompter');
  const btnSwarmPrompt = document.getElementById('btn-swarm-prompt');
  
  if (swarmPrompter && btnSwarmPrompt) {
    btnSwarmPrompt.addEventListener('click', () => {
      handleSwarmPrompt(swarmPrompter.value);
    });
    swarmPrompter.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleSwarmPrompt(swarmPrompter.value);
      }
    });
  }

  // Theme Toggle Logic
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const careerThemeSelect = document.getElementById('career-theme');

  function triggerChartThemeRedraw() {
    if (AppState.activeTab === 'job-detail' && AppState.activeJobId) {
      const activeJob = AppState.jobs.find(j => j.id === AppState.activeJobId);
      if (activeJob) {
        const jobCandidates = AppState.candidates.filter(
          c => c.jobApplied === activeJob.roleName || c.jobApplied === activeJob.cardName
        );
        drawFunnelSVG(activeJob, jobCandidates);
        drawScoreDistributionSVG(activeJob, jobCandidates);
      }
    }
  }
  
  if (btnThemeToggle) {
    const savedTheme = localStorage.getItem('IntervieHire-theme');
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    
    if (savedTheme === 'light' || (!savedTheme && prefersLight)) {
      document.body.classList.add('light-theme');
      if (careerThemeSelect) careerThemeSelect.value = 'light';
    } else {
      if (careerThemeSelect) careerThemeSelect.value = 'dark';
    }

    btnThemeToggle.addEventListener('click', () => {
      const isLight = document.body.classList.toggle('light-theme');
      const themeVal = isLight ? 'light' : 'dark';
      localStorage.setItem('IntervieHire-theme', themeVal);
      if (careerThemeSelect) {
        careerThemeSelect.value = themeVal;
      }
      triggerChartThemeRedraw();
      if (isLight) {
        soundEngine.playChime([329.63, 392.00, 523.25], 0.12, 0.1);
      } else {
        soundEngine.playChime([523.25, 392.00, 261.63], 0.12, 0.1);
      }
    });
  }

  if (careerThemeSelect) {
    careerThemeSelect.addEventListener('change', (e) => {
      const shouldBeLight = e.target.value === 'light';
      const isCurrentLight = document.body.classList.contains('light-theme');
      if (shouldBeLight !== isCurrentLight) {
        document.body.classList.toggle('light-theme', shouldBeLight);
        localStorage.setItem('IntervieHire-theme', shouldBeLight ? 'light' : 'dark');
        triggerChartThemeRedraw();
        if (shouldBeLight) {
          soundEngine.playChime([329.63, 392.00, 523.25], 0.12, 0.1);
        } else {
          soundEngine.playChime([523.25, 392.00, 261.63], 0.12, 0.1);
        }
      }
    });
  }

  // JD sub-tab switching
  document.querySelectorAll('.jd-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-jd-tab');
      document.querySelectorAll('.jd-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.jd-pane').forEach(p => p.classList.remove('active'));
      const pane = document.getElementById(`jd-pane-${tabId}`);
      if (pane) pane.classList.add('active');
      soundEngine.playClick();
      
      // Stop any active card audio playing
      stopActiveCardPlayer();
      
      // Render detail panes if there is an active job
      if (AppState.activeJobId) {
        const job = AppState.jobs.find(j => j.id === AppState.activeJobId);
        if (job) {
          renderJobDetailPanes(job);
        }
      }
    });
  });

  // JD score type dropdown re-renders chart
  const jdScoreType = document.getElementById('jd-score-type');
  if (jdScoreType) {
    jdScoreType.addEventListener('change', () => {
      if (AppState.activeJobId) {
        const job = AppState.jobs.find(j => j.id === AppState.activeJobId);
        if (job) {
          const jobCandidates = AppState.candidates.filter(
            c => c.jobApplied === job.roleName || c.jobApplied === job.cardName
          );
          drawScoreDistributionSVG(job, jobCandidates);
        }
      }
      soundEngine.playClick();
    });
  }

  // ==========================================
  // CREATE JOB PAGE BINDINGS
  // ==========================================

  // Lina "Start Creation" button
  const btnStartAria = document.getElementById('btn-start-aria-creation');
  if (btnStartAria) {
    btnStartAria.addEventListener('click', () => {
      soundEngine.playChime([392, 523.25, 659.25], 0.12, 0.1);
      navigateToAriaChat();
    });
  }

  // "No file? click here" toggles paste textarea
  const btnNoFile = document.getElementById('btn-no-file-click');
  if (btnNoFile) {
    btnNoFile.addEventListener('click', (e) => {
      e.preventDefault();
      const pasteArea = document.getElementById('create-jd-paste');
      const dropzone = document.getElementById('jd-dropzone');
      if (!pasteArea) return;
      const isShowing = pasteArea.style.display !== 'none';
      pasteArea.style.display = isShowing ? 'none' : 'block';
      if (dropzone) dropzone.style.display = isShowing ? 'flex' : 'none';
      btnNoFile.textContent = isShowing ? 'No file? click here' : 'Use file upload instead';
      if (!isShowing) { pasteArea.focus(); }
    });
  }

  // Dropzone file select
  const jdDropzone = document.getElementById('jd-dropzone');
  const jdFileInput = document.getElementById('jd-file-input');

  function handleCreateJobFile(file) {
    if (!file) return;
    createJobUploadedFileName = file.name;
    const preview = document.getElementById('dropzone-file-preview');
    if (preview) {
      preview.style.display = 'flex';
      preview.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${file.name}</span>
        <button class="dropzone-remove-btn" id="btn-dropzone-remove">×</button>
      `;
      document.getElementById('btn-dropzone-remove')?.addEventListener('click', (e) => {
        e.stopPropagation();
        createJobUploadedFileName = null;
        createJobUploadedText = null;
        preview.style.display = 'none';
        preview.innerHTML = '';
        if (jdDropzone) jdDropzone.classList.remove('has-file');
        if (jdFileInput) jdFileInput.value = '';
        soundEngine.playClick();
      });
    }
    if (jdDropzone) jdDropzone.classList.add('has-file');
    const reader = new FileReader();
    reader.onload = (ev) => { createJobUploadedText = ev.target.result; };
    reader.onerror = () => { createJobUploadedText = null; };
    reader.readAsText(file);
    soundEngine.playChime([523.25], 0.1, 0.08);
  }

  if (jdDropzone) {
    jdDropzone.addEventListener('click', () => jdFileInput?.click());
    jdDropzone.addEventListener('dragover', (e) => { e.preventDefault(); jdDropzone.classList.add('drag-over'); });
    jdDropzone.addEventListener('dragleave', () => jdDropzone.classList.remove('drag-over'));
    jdDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      jdDropzone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleCreateJobFile(file);
    });
  }
  if (jdFileInput) {
    jdFileInput.addEventListener('change', () => {
      if (jdFileInput.files[0]) handleCreateJobFile(jdFileInput.files[0]);
    });
  }

  // Continue button — process file or pasted text with DeepSeek
  const btnContinue = document.getElementById('btn-create-job-continue');
  if (btnContinue) {
    btnContinue.addEventListener('click', async () => {
      const pasteArea = document.getElementById('create-jd-paste');
      const pastedText = (pasteArea && pasteArea.style.display !== 'none') ? pasteArea.value.trim() : '';
      const textToProcess = pastedText || createJobUploadedText;
      const sourceName = createJobUploadedFileName || 'pasted text';

      if (!textToProcess) {
        showPremiumToast("Upload a file or paste a job description first.", "error");
        return;
      }

      const originalHTML = btnContinue.innerHTML;
      btnContinue.disabled = true;
      btnContinue.innerHTML = `<div class="spinner-mini" style="display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin-mini 0.6s linear infinite;margin-right:6px;vertical-align:middle;"></div> Processing...`;

      soundEngine.playChime([392, 440], 0.1, 0.1);

      const systemPrompt = `You are a job description parser. Extract structured job info from the provided text.
Return ONLY valid JSON:
{"roleName":"exact job title","cardName":"job title + brief context","experienceBand":"one of: Upto 2 Years | 1-4 Years | 3-6 Years | 5+ Years | 8+ Years","description":"clean 2-3 sentence professional job description"}`;

      try {
        const response = await callDeepSeekAPI([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Parse this job description:\n\n${textToProcess.slice(0, 2500)}` }
        ], true);

        const parsed = JSON.parse(sanitizeJSONResponse(response));
        const newJob = {
          id: generateJobId(),
          roleName: parsed.roleName,
          cardName: parsed.cardName || parsed.roleName,
          created: new Date().toLocaleString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
          status: 'published',
          customJobId: '-',
          experienceBand: parsed.experienceBand || 'Upto 2 Years',
          createdBy: 'Devasri',
          description: parsed.description || textToProcess.slice(0, 500),
          questions: [],
          pipeline: { total: 0, resume: 0, screening: 0, functional: 0 }
        };
        AppState.jobs.unshift(newJob);
        saveStateToLocalStorage();
        showPremiumToast(`Job "${parsed.roleName}" created successfully.`, "success");
        soundEngine.playChime([329.63, 392, 523.25], 0.2, 0.08);
        navigateToJobDetail(newJob.id);
      } catch (err) {
        console.error("Job creation from JD failed:", err);
        showPremiumToast("Failed to process job description. Check API status.", "error");
        btnContinue.disabled = false;
        btnContinue.innerHTML = originalHTML;
      }
    });
  }

  // Lina chat send button + Enter key
  const ariaChatInput = document.getElementById('aria-chat-input');
  const ariaSendBtn = document.getElementById('btn-aria-send');

  if (ariaSendBtn && ariaChatInput) {
    ariaSendBtn.addEventListener('click', () => sendAriaMessage(ariaChatInput.value));
    ariaChatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendAriaMessage(ariaChatInput.value);
      }
    });
  }

  // Initial Load Actions
  renderJobCards();
  startSwarmLogs();

  // Initialize Crystal Glass Sliding Tab Pills
  initSlidingPills();

  // Initialize Sourcing and Mass Applicant Addition
  initSourcing();

  // Initialize Kanban Drag & Drop
  initKanbanDragAndDrop();

  // Candidates Search Filter on job details sub-panes
  const jdSearchInput = document.getElementById('jd-candidate-search');
  if (jdSearchInput) {
    jdSearchInput.addEventListener('input', () => {
      if (AppState.activeJobId) {
        const job = AppState.jobs.find(j => j.id === AppState.activeJobId);
        if (job) {
          renderJobDetailPanes(job);
        }
      }
    });
  }

  // Close button inside Agent Drawer
  const btnCloseAgent = document.getElementById('btn-close-drawer-agent');
  if (btnCloseAgent) {
    btnCloseAgent.addEventListener('click', closeDrawers);
  }

  // Agent slider value displays
  const tempSlider = document.getElementById('agent-temp-slider');
  if (tempSlider) {
    tempSlider.addEventListener('input', (e) => {
      document.getElementById('agent-temp-val').textContent = parseFloat(e.target.value).toFixed(1);
    });
  }
  const threshSlider = document.getElementById('agent-threshold-slider');
  if (threshSlider) {
    threshSlider.addEventListener('input', (e) => {
      document.getElementById('agent-threshold-val').textContent = `${e.target.value}%`;
    });
  }

  // Bind Swarm Agent Customizer Drawers trigger on agent-cards clicking
  const bindAgentCard = (elementId, agentKey, agentName) => {
    const card = document.getElementById(elementId);
    if (card) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        const overlay = document.getElementById('drawer-backdrop');
        overlay.classList.add('active');
        
        const drawer = document.getElementById('drawer-agent-config');
        drawer.classList.add('active');
        
        const config = AppState.agentConfigs[agentKey];
        document.getElementById('agent-config-title').textContent = `Configure ${agentName}`;
        document.getElementById('config-agent-id').value = agentKey;
        document.getElementById('agent-model-select').value = config.model;
        document.getElementById('agent-temp-slider').value = config.temperature;
        document.getElementById('agent-temp-val').textContent = config.temperature.toFixed(1);
        document.getElementById('agent-threshold-slider').value = config.threshold;
        document.getElementById('agent-threshold-val').textContent = `${config.threshold}%`;
        document.getElementById('agent-prompt-input').value = config.prompt;
        
        soundEngine.playChime([392.00, 523.25], 0.12, 0.1);
      });
    }
  };

  bindAgentCard('agent-aria', 'aria', 'Lina');
  bindAgentCard('agent-kaelen', 'kaelen', 'Kaelen');
  bindAgentCard('agent-lyra', 'lyra', 'Lyra');

  // Submit Agent settings config
  const formAgentConfig = document.getElementById('form-agent-config');
  if (formAgentConfig) {
    formAgentConfig.addEventListener('submit', (e) => {
      e.preventDefault();
      const agentKey = document.getElementById('config-agent-id').value;
      const config = AppState.agentConfigs[agentKey];
      if (config) {
        config.model = document.getElementById('agent-model-select').value;
        config.temperature = parseFloat(document.getElementById('agent-temp-slider').value);
        config.threshold = parseInt(document.getElementById('agent-threshold-slider').value);
        config.prompt = document.getElementById('agent-prompt-input').value;
        
        closeDrawers();
        showPremiumToast(`Saved agent configuration settings.`, 'success');
        soundEngine.playChime([261.63, 392.00, 523.25], 0.2, 0.08);
      }
    });
  }

  // Initialize Crystal Dashboard Animations
  if (document.querySelector('.scene')) {
    initCrystalAnimations();
  }
});

// ==========================================
// CRYSTAL GLASS SLIDING PILLS ENGINE (iOS-style Segmented Control)
// ==========================================
function updateSlidingPill(container) {
  if (!container) return;
  
  // Ensure track container has correct position styling
  const containerStyle = window.getComputedStyle(container);
  if (containerStyle.position === 'static') {
    container.style.position = 'relative';
  }
  
  let pill = container.querySelector('.sliding-pill');
  if (!pill) {
    pill = document.createElement('span');
    pill.className = 'sliding-pill';
    container.insertBefore(pill, container.firstChild);
  }
  
  setTimeout(() => {
    const activeTab = container.querySelector('.active') || 
                      container.querySelector('.active-sub') ||
                      container.querySelector('.nav-item.active') || 
                      container.querySelector('.filter-tab.active') || 
                      container.querySelector('.table-tab-btn.active') || 
                      container.querySelector('.report-tab-btn.active') || 
                      container.querySelector('.jd-tab.active');
                      
    if (!activeTab) {
      pill.style.opacity = '0';
      return;
    }
    
    // Bounds calculations relative to parent track container
    const rect = activeTab.getBoundingClientRect();
    const parentRect = container.getBoundingClientRect();
    
    const top = rect.top - parentRect.top;
    const left = rect.left - parentRect.left;
    const width = rect.width;
    const height = rect.height;
    
    // Check if the tab is hidden or has 0 width (e.g. inactive views)
    if (width === 0 || height === 0) {
      pill.style.opacity = '0';
      return;
    }
    
    pill.style.opacity = '1';
    pill.style.width = `${width}px`;
    pill.style.height = `${height}px`;
    pill.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    
    const activeStyle = window.getComputedStyle(activeTab);
    pill.style.borderRadius = activeStyle.borderRadius || '8px';
  }, 20);
}

function updateAllSlidingPills() {
  const tracks = document.querySelectorAll('.sidebar-nav ul, .filter-options, .table-tabs, #team-status-tabs, .report-tabs, .jd-tabs, .sub-nav, .sourcing-mode-toggle');
  tracks.forEach(track => updateSlidingPill(track));
}

function initSlidingPills() {
  const tracks = document.querySelectorAll('.sidebar-nav ul, .filter-options, .table-tabs, #team-status-tabs, .report-tabs, .jd-tabs, .sub-nav, .sourcing-mode-toggle');
  
  tracks.forEach(track => {
    // Initial paint
    updateSlidingPill(track);
    
    // Auto-listen to click events within track
    track.addEventListener('click', (e) => {
      const isTab = e.target.closest('.nav-item, .filter-tab, .table-tab-btn, .report-tab-btn, .jd-tab, .sub-nav li, .mode-toggle-btn');
      if (isTab) {
        updateSlidingPill(track);
      }
    });
  });
  
  // Recalculate on window resize
  window.addEventListener('resize', updateAllSlidingPills);
  
  // Also watch for DOM changes (like when views are rendered dynamically or hidden/shown)
  const observer = new MutationObserver((mutations) => {
    let shouldUpdate = false;
    for (let mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        shouldUpdate = true;
        break;
      }
    }
    if (shouldUpdate) {
      updateAllSlidingPills();
    }
  });
  
  tracks.forEach(track => {
    observer.observe(track, { attributes: true, subtree: true, attributeFilter: ['class'] });
  });
  
  // Set up initial trigger for tabs in hidden/active views
  setTimeout(updateAllSlidingPills, 100);
  setTimeout(updateAllSlidingPills, 300); // Back up for view rendering latency
}

// ============================================================
// SOURCING VIEW CONTROLLER & MASS INTAKE LOGIC
// ============================================================

let sourcingQueue = [];
let csvParsedCandidates = [];
let uploadedFiles = [];
let currentSourcingMode = 'schedule';
let currentSourcingTab = 'csv';

function initSourcing() {
  // Bind click on '+ Add Applicants' inside job detail overview
  const addApplicantsBtn = document.querySelector('.btn-jd-primary');
  if (addApplicantsBtn) {
    addApplicantsBtn.addEventListener('click', () => {
      navigateToSourcing(AppState.activeJobId);
    });
  }

  // Breadcrumbs navigation link back clicks
  const srcBcJobs = document.getElementById('src-bc-jobs');
  if (srcBcJobs) {
    srcBcJobs.addEventListener('click', () => {
      navigateToTab('jobs');
    });
  }
  
  const srcBcJobname = document.getElementById('src-bc-jobname');
  if (srcBcJobname) {
    srcBcJobname.addEventListener('click', () => {
      navigateToJobDetail(AppState.activeJobId);
    });
  }

  // View Responses button click (goes back to job detail overview)
  const viewResponsesBtn = document.getElementById('btn-src-view-responses');
  if (viewResponsesBtn) {
    viewResponsesBtn.addEventListener('click', () => {
      navigateToJobDetail(AppState.activeJobId);
    });
  }

  // Add Collaborator inside sourcing
  const srcCollabBtn = document.getElementById('btn-src-collaborator');
  if (srcCollabBtn) {
    srcCollabBtn.addEventListener('click', () => {
      openDrawer('member');
    });
  }

  // Sourcing mode toggle buttons
  const modeButtons = document.querySelectorAll('.mode-toggle-btn');
  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-sourcing-mode');
      switchSourcingMode(mode);
    });
  });

  // Tab card selectors
  const tabCards = document.querySelectorAll('.sourcing-tab-card');
  tabCards.forEach(card => {
    card.addEventListener('click', () => {
      if (card.classList.contains('locked')) {
        soundEngine.playClick();
        switchSourcingTab('ats');
        return;
      }
      const tab = card.getAttribute('data-sourcing-tab');
      switchSourcingTab(tab);
    });
  });

  // === CSV Panel Event Bindings ===
  const btnDownloadCsv = document.getElementById('btn-download-csv-template');
  if (btnDownloadCsv) {
    btnDownloadCsv.addEventListener('click', (e) => {
      e.preventDefault();
      downloadCsvTemplate();
    });
  }

  const btnBrowseCsv = document.getElementById('btn-browse-csv');
  const inputFileCsv = document.getElementById('input-file-csv');
  if (btnBrowseCsv && inputFileCsv) {
    btnBrowseCsv.addEventListener('click', () => {
      inputFileCsv.click();
    });
    inputFileCsv.addEventListener('change', handleCsvFileSelect);
  }

  // Drag & drop for CSV
  const dropzoneCsv = document.getElementById('dropzone-csv');
  if (dropzoneCsv) {
    dropzoneCsv.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzoneCsv.classList.add('dragover');
    });
    dropzoneCsv.addEventListener('dragleave', () => {
      dropzoneCsv.classList.remove('dragover');
    });
    dropzoneCsv.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzoneCsv.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].name.endsWith('.csv')) {
        parseCsvFile(files[0]);
      } else {
        showPremiumToast("Please drop a valid .csv file.", "error");
      }
    });
    dropzoneCsv.addEventListener('click', () => {
      inputFileCsv.click();
    });
  }

  const btnCsvCancel = document.getElementById('btn-csv-cancel');
  if (btnCsvCancel) {
    btnCsvCancel.addEventListener('click', () => {
      csvParsedCandidates = [];
      document.getElementById('csv-preview-box').style.display = 'none';
      if (inputFileCsv) inputFileCsv.value = '';
      soundEngine.playClick();
    });
  }

  const btnCsvImport = document.getElementById('btn-csv-import');
  if (btnCsvImport) {
    btnCsvImport.addEventListener('click', () => {
      importCsvCandidates();
    });
  }

  // === Resumes Panel Event Bindings ===
  const btnBrowseResumes = document.getElementById('btn-browse-resumes');
  const inputFileResumes = document.getElementById('input-file-resumes');
  if (btnBrowseResumes && inputFileResumes) {
    btnBrowseResumes.addEventListener('click', () => {
      inputFileResumes.click();
    });
    inputFileResumes.addEventListener('change', handleResumesFileSelect);
  }

  // Drag & drop for Resumes
  const dropzoneResumes = document.getElementById('dropzone-resumes');
  if (dropzoneResumes) {
    dropzoneResumes.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzoneResumes.classList.add('dragover');
    });
    dropzoneResumes.addEventListener('dragleave', () => {
      dropzoneResumes.classList.remove('dragover');
    });
    dropzoneResumes.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzoneResumes.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        simulateResumesParsing(files);
      }
    });
    dropzoneResumes.addEventListener('click', () => {
      inputFileResumes.click();
    });
  }

  const btnResumesCancel = document.getElementById('btn-resumes-cancel');
  if (btnResumesCancel) {
    btnResumesCancel.addEventListener('click', () => {
      uploadedFiles = [];
      document.getElementById('resumes-preview-box').style.display = 'none';
      if (inputFileResumes) inputFileResumes.value = '';
      soundEngine.playClick();
    });
  }

  const btnResumesImport = document.getElementById('btn-resumes-import');
  if (btnResumesImport) {
    btnResumesImport.addEventListener('click', () => {
      importResumesCandidates();
    });
  }

  // === Manual Entry Event Bindings ===
  const formManual = document.getElementById('form-manual-candidate');
  if (formManual) {
    formManual.addEventListener('submit', (e) => {
      e.preventDefault();
      addCandidateToManualQueue();
    });
  }

  const btnClearManual = document.getElementById('btn-clear-manual');
  if (btnClearManual) {
    btnClearManual.addEventListener('click', () => {
      sourcingQueue = [];
      renderManualQueue();
      soundEngine.playClick();
    });
  }

  const btnManualImport = document.getElementById('btn-manual-import');
  if (btnManualImport) {
    btnManualImport.addEventListener('click', () => {
      importManualQueue();
    });
  }

  // === Locked ATS features event ===
  const btnUpgradeSourcing = document.querySelector('.btn-upgrade-sourcing');
  if (btnUpgradeSourcing) {
    btnUpgradeSourcing.addEventListener('click', () => {
      soundEngine.playClick();
      showPremiumToast("ATS Integration is an Enterprise level feature. Please upgrade your plan.", "error");
    });
  }
}

function navigateToSourcing(jobId) {
  const job = AppState.jobs.find(j => j.id === jobId);
  if (!job) return;

  AppState.activeJobId = jobId;
  AppState.activeTab = 'sourcing';

  // Highlight Jobs sidebar
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-tab') === 'jobs');
  });

  // Breadcrumbs text config
  const shortName = job.cardName.length > 24 ? job.cardName.slice(0, 24) + '…' : job.cardName;
  const srcBcJobname = document.getElementById('src-bc-jobname');
  if (srcBcJobname) {
    srcBcJobname.textContent = shortName;
  }

  // Switch view section visibility
  document.querySelectorAll('.dashboard-view').forEach(v => v.classList.remove('active-view'));
  document.getElementById('view-sourcing').classList.add('active-view');

  // Hide the global page header action button
  const actionBtn = document.getElementById('header-action-btn');
  if (actionBtn) actionBtn.style.display = 'none';

  // Reset inputs & states
  sourcingQueue = [];
  csvParsedCandidates = [];
  uploadedFiles = [];
  renderManualQueue();
  document.getElementById('csv-preview-box').style.display = 'none';
  document.getElementById('resumes-preview-box').style.display = 'none';
  
  const formManual = document.getElementById('form-manual-candidate');
  if (formManual) formManual.reset();

  const fileCsv = document.getElementById('input-file-csv');
  if (fileCsv) fileCsv.value = '';
  const fileRes = document.getElementById('input-file-resumes');
  if (fileRes) fileRes.value = '';

  // Default mode & tab
  switchSourcingMode('schedule');

  setTimeout(updateAllSlidingPills, 50);
  soundEngine.playChime([329.63, 392.00, 523.25], 0.15, 0.08);
}

function switchSourcingMode(mode) {
  currentSourcingMode = mode;

  // Toggle active class on pills
  const modeButtons = document.querySelectorAll('.mode-toggle-btn');
  modeButtons.forEach(btn => {
    const btnMode = btn.getAttribute('data-sourcing-mode');
    btn.classList.toggle('active', btnMode === mode);
  });

  // Show/Hide Grid cards based on active mode
  const csvCard = document.getElementById('card-src-csv');
  const manualCard = document.getElementById('card-src-manual');

  if (mode === 'analyse') {
    if (csvCard) csvCard.style.display = 'none';
    if (manualCard) manualCard.style.display = 'none';
    
    // Default to Resumes tab for Analyse mode
    if (currentSourcingTab !== 'resumes' && currentSourcingTab !== 'ats') {
      currentSourcingTab = 'resumes';
    }
  } else {
    if (csvCard) csvCard.style.display = 'flex';
    if (manualCard) manualCard.style.display = 'flex';
  }

  // Refresh active tab views
  switchSourcingTab(currentSourcingTab);
  setTimeout(updateAllSlidingPills, 50);
  soundEngine.playClick();
}

function switchSourcingTab(tab) {
  currentSourcingTab = tab;

  // Toggle card active states
  const tabCards = document.querySelectorAll('.sourcing-tab-card');
  tabCards.forEach(card => {
    const cardTab = card.getAttribute('data-sourcing-tab');
    card.classList.toggle('active', cardTab === tab);
  });

  // Toggle active workspace panel visibility
  const panels = document.querySelectorAll('.sourcing-panel');
  panels.forEach(panel => {
    const panelId = panel.id;
    const isActive = panelId === `panel-src-${tab}`;
    panel.classList.toggle('active', isActive);
    panel.style.display = isActive ? 'block' : 'none';
  });

  setTimeout(updateAllSlidingPills, 50);
  soundEngine.playClick();
}

// === CSV Intake Logic ===
function downloadCsvTemplate() {
  const csvContent = "Name,Email,Phone\\nJohn Doe,john.doe@example.com,+15550192834\\nJane Smith,jane.smith@example.com,\\nAditya Rana,aditya@IntervieHire.com,+919988776655";
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "IntervieHire_candidates_template.csv");
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  soundEngine.playClick();
}

function handleCsvFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  parseCsvFile(file);
}

function parseCsvFile(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    processCsvText(text);
  };
  reader.readAsText(file);
}

function processCsvText(text) {
  const lines = text.split(/\\r?\\n/);
  if (lines.length === 0) return;

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const nameIndex = headers.indexOf('name');
  const emailIndex = headers.indexOf('email');
  const phoneIndex = headers.indexOf('phone');

  if (nameIndex === -1 || emailIndex === -1) {
    showPremiumToast("Invalid CSV. Header row must contain Name and Email.", "error");
    return;
  }

  csvParsedCandidates = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',').map(c => c.trim());
    if (cols.length <= Math.max(nameIndex, emailIndex)) continue;

    const name = cols[nameIndex];
    const email = cols[emailIndex];
    const phone = phoneIndex !== -1 ? (cols[phoneIndex] || '') : '';

    if (name && email) {
      csvParsedCandidates.push({ name, email, phone });
    }
  }

  if (csvParsedCandidates.length === 0) {
    showPremiumToast("No valid candidates found in CSV.", "error");
    return;
  }

  renderCsvPreview();
}

function renderCsvPreview() {
  const box = document.getElementById('csv-preview-box');
  const countSpan = document.getElementById('csv-parsed-count');
  const tbody = document.getElementById('csv-preview-rows');

  if (!box || !countSpan || !tbody) return;

  countSpan.textContent = csvParsedCandidates.length;
  tbody.innerHTML = csvParsedCandidates.map(cand => `
    <tr>
      <td><strong>\${cand.name}</strong></td>
      <td>\${cand.email}</td>
      <td>\${cand.phone || '-'}</td>
      <td><span class="upload-file-status-badge done">Ready to Sync</span></td>
    </tr>
  `).join('');

  box.style.display = 'block';
  soundEngine.playChime([392.00, 523.25], 0.15, 0.08);
}

function importCsvCandidates() {
  if (csvParsedCandidates.length === 0) return;

  const activeJob = AppState.jobs.find(j => j.id === AppState.activeJobId);
  if (!activeJob) return;

  csvParsedCandidates.forEach(cand => {
    addCandidateToAppState(cand.name, cand.email, cand.phone, activeJob);
  });

  soundEngine.playChime([392.00, 523.25, 659.25], 0.2, 0.08);
  showPremiumToast(`Successfully imported \${csvParsedCandidates.length} candidate(s) into "\${activeJob.roleName}".`, "success");

  // Reset
  csvParsedCandidates = [];
  document.getElementById('csv-preview-box').style.display = 'none';
  const fileCsv = document.getElementById('input-file-csv');
  if (fileCsv) fileCsv.value = '';

  // Synchronize and navigate back
  recalculateJobPipelines();
  updateSummaryMetrics();
  renderAnalyticsTable();
  
  if (document.getElementById('jobs-board-container') && document.getElementById('jobs-board-container').style.display !== 'none') {
    renderKanbanBoard();
  } else {
    renderJobCards();
  }

  navigateToJobDetail(AppState.activeJobId);
}

// === Resumes Intake Logic ===
function handleResumesFileSelect(event) {
  const files = event.target.files;
  if (files.length === 0) return;
  simulateResumesParsing(files);
}

function simulateResumesParsing(files) {
  const box = document.getElementById('resumes-preview-box');
  const filesList = document.getElementById('resumes-files-list');
  const countSpan = document.getElementById('resumes-upload-count');
  const importBtn = document.getElementById('btn-resumes-import');

  if (!box || !filesList || !countSpan || !importBtn) return;

  box.style.display = 'block';
  countSpan.textContent = files.length;
  importBtn.disabled = true;

  uploadedFiles = [];
  filesList.innerHTML = '';

  Array.from(files).forEach((file, idx) => {
    const item = {
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB',
      progress: 0,
      status: 'parsing'
    };
    uploadedFiles.push(item);

    const fileRow = document.createElement('div');
    fileRow.className = 'upload-file-item';
    fileRow.id = `file-item-\${idx}`;
    fileRow.innerHTML = `
      <div class="upload-file-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
      </div>
      <div class="upload-file-info">
        <span class="upload-file-name">\${item.name}</span>
        <div class="upload-file-size">\${item.size}</div>
      </div>
      <div class="upload-file-progress-wrap">
        <div class="upload-file-progress-bar">
          <div class="upload-file-progress-inner" id="progress-inner-\${idx}"></div>
        </div>
      </div>
      <span class="upload-file-status-badge parsing" id="status-badge-\${idx}">Analyzing...</span>
    `;
    filesList.appendChild(fileRow);

    // Simulate progress bars
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.floor(Math.random() * 20 + 15);
      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(interval);

        const badge = document.getElementById(`status-badge-\${idx}`);
        if (badge) {
          badge.textContent = 'Extracted';
          badge.className = 'upload-file-status-badge done';
        }

        item.status = 'done';
        checkAllResumesDone();
      }

      const progressInner = document.getElementById(`progress-inner-\${idx}`);
      if (progressInner) {
        progressInner.style.width = `\${currentProgress}%`;
      }
    }, 150 + Math.random() * 150);
  });
}

function checkAllResumesDone() {
  const allDone = uploadedFiles.every(f => f.status === 'done');
  if (allDone) {
    const importBtn = document.getElementById('btn-resumes-import');
    if (importBtn) importBtn.disabled = false;
    soundEngine.playChime([523.25, 659.25], 0.12, 0.08);
  }
}

function importResumesCandidates() {
  if (uploadedFiles.length === 0) return;

  const activeJob = AppState.jobs.find(j => j.id === AppState.activeJobId);
  if (!activeJob) return;

  uploadedFiles.forEach(file => {
    const rawName = extractCandidateNameFromFilename(file.name);
    const email = rawName.toLowerCase().replace(/\\s+/g, ".") + "@example.com";
    const phone = "+1 (555) 01" + Math.floor(Math.random() * 900 + 100);
    addCandidateToAppState(rawName, email, phone, activeJob);
  });

  soundEngine.playChime([392.00, 523.25, 659.25], 0.2, 0.08);
  showPremiumToast(`Successfully processed and imported \${uploadedFiles.length} candidate(s) into "\${activeJob.roleName}".`, "success");

  // Reset
  uploadedFiles = [];
  document.getElementById('resumes-preview-box').style.display = 'none';
  const fileRes = document.getElementById('input-file-resumes');
  if (fileRes) fileRes.value = '';

  // Synchronize and navigate back
  recalculateJobPipelines();
  updateSummaryMetrics();
  renderAnalyticsTable();
  
  if (document.getElementById('jobs-board-container') && document.getElementById('jobs-board-container').style.display !== 'none') {
    renderKanbanBoard();
  } else {
    renderJobCards();
  }

  navigateToJobDetail(AppState.activeJobId);
}

function extractCandidateNameFromFilename(filename) {
  let name = filename.replace(/\\.[^/.]+$/, ""); // strip extension
  name = name.replace(/[_\-\\.]/g, " "); // replace symbols
  name = name.replace(/\\b(resume|cv|hiring|job|developer|executive|profile|senior|junior|doc|pdf|en)\\b/gi, "");
  name = name.trim().split(/\\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  if (!name) name = "Candidate " + Math.floor(Math.random() * 1000);
  return name;
}

// === Manual Queue Intake Logic ===
function addCandidateToManualQueue() {
  const nameInput = document.getElementById('manual-name');
  const emailInput = document.getElementById('manual-email');
  const phoneInput = document.getElementById('manual-phone');

  if (!nameInput || !emailInput) return;

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const phone = phoneInput ? phoneInput.value.trim() : '';

  if (!name || !email) return;

  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  if (!emailRegex.test(email)) {
    showPremiumToast("Please enter a valid email address.", "error");
    return;
  }

  sourcingQueue.push({ name, email, phone });
  renderManualQueue();

  // Reset inputs
  nameInput.value = '';
  emailInput.value = '';
  if (phoneInput) phoneInput.value = '';

  soundEngine.playClick();
}

function removeCandidateFromQueue(index) {
  sourcingQueue.splice(index, 1);
  renderManualQueue();
  soundEngine.playClick();
}
window.removeCandidateFromQueue = removeCandidateFromQueue;

function renderManualQueue() {
  const container = document.getElementById('manual-queue-list');
  const countSpan = document.getElementById('manual-queue-count');
  const clearBtn = document.getElementById('btn-clear-manual');
  const importBtn = document.getElementById('btn-manual-import');
  const emptyState = document.getElementById('manual-queue-empty');

  if (!container || !countSpan || !clearBtn || !importBtn || !emptyState) return;

  countSpan.textContent = sourcingQueue.length;

  if (sourcingQueue.length === 0) {
    emptyState.style.display = 'flex';
    container.innerHTML = '';
    clearBtn.style.display = 'none';
    importBtn.disabled = true;
    return;
  }

  emptyState.style.display = 'none';
  clearBtn.style.display = 'block';
  importBtn.disabled = false;

  container.innerHTML = sourcingQueue.map((cand, idx) => `
    <li class="queue-item">
      <div class="queue-item-details">
        <span class="queue-item-name">\${cand.name}</span>
        <span class="queue-item-email">\${cand.email} \${cand.phone ? ' · ' + cand.phone : ''}</span>
      </div>
      <button class="btn-remove-queue" onclick="removeCandidateFromQueue(\${idx})" title="Remove">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </li>
  `).join('');
}

function importManualQueue() {
  if (sourcingQueue.length === 0) return;

  const activeJob = AppState.jobs.find(j => j.id === AppState.activeJobId);
  if (!activeJob) return;

  sourcingQueue.forEach(cand => {
    addCandidateToAppState(cand.name, cand.email, cand.phone, activeJob);
  });

  soundEngine.playChime([392.00, 523.25, 659.25], 0.2, 0.08);
  showPremiumToast(`Successfully imported \${sourcingQueue.length} candidate(s) into "\${activeJob.roleName}".`, "success");

  sourcingQueue = [];
  renderManualQueue();

  // Synchronize and navigate back
  recalculateJobPipelines();
  updateSummaryMetrics();
  renderAnalyticsTable();
  
  if (document.getElementById('jobs-board-container') && document.getElementById('jobs-board-container').style.display !== 'none') {
    renderKanbanBoard();
  } else {
    renderJobCards();
  }

  navigateToJobDetail(AppState.activeJobId);
}

// === Shared Candidate Insertion helper ===
function addCandidateToAppState(name, email, phone, job) {
  const idChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let candId = 'CAN-';
  for (let i = 0; i < 4; i++) {
    candId += idChars[Math.floor(Math.random() * 10)];
  }
  candId += '-' + idChars[Math.floor(Math.random() * idChars.length)] + idChars[Math.floor(Math.random() * idChars.length)] + Math.floor(Math.random() * 9);

  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hours = now.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formatHour = hours % 12 || 12;
  const dateStr = `\${now.getDate().toString().padStart(2, '0')} \${months[now.getMonth()]} \${now.getFullYear()}, \${formatHour.toString().padStart(2, '0')}:\${now.getMinutes().toString().padStart(2, '0')} \${ampm}`;

  const status = currentSourcingMode === 'analyse' ? 'Resume' : 'Screening';
  const score = `\${Math.floor(Math.random() * 20 + 80)}%`;

  AppState.candidates.push({
    id: candId,
    name: name,
    email: email,
    jobApplied: job.roleName,
    status: status,
    score: score,
    registeredOn: dateStr
  });
}

function showPremiumToast(message, type = 'success') {
  const existing = document.querySelector('.toast-notification');
  if (existing) {
    existing.remove();
  }
  
  const toast = document.createElement('div');
  toast.className = `toast-notification \${type}`;
  
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  } else {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
  }
  
  toast.innerHTML = `
    <span class="toast-icon">\${iconSvg}</span>
    <span class="toast-message">\${message}</span>
  `;
  
  document.body.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 450);
  }, 2800);
}

// === Drag and Drop, Column Customization, Stage Panes and Agent Customization ===

let activeCardPlayerId = null;
let activeCardInterval = null;
let activeCardTime = 0; // ms
const cardDuration = 15000; // 15 seconds

function initKanbanDragAndDrop() {
  const cols = {
    Resume: document.getElementById('col-resume'),
    Screening: document.getElementById('col-screening'),
    Functional: document.getElementById('col-functional'),
    Hired: document.getElementById('col-hired')
  };

  Object.entries(cols).forEach(([stage, col]) => {
    if (!col) return;

    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.classList.add('drag-hover');
    });

    col.addEventListener('dragleave', () => {
      col.classList.remove('drag-hover');
    });

    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('drag-hover');
      
      const candidateId = e.dataTransfer.getData('text/plain');
      const candidate = AppState.candidates.find(c => c.id === candidateId);
      
      if (candidate && candidate.status !== stage) {
        const oldStatus = candidate.status;
        candidate.status = stage;
        
        soundEngine.playChime([329.63, 440.00, 523.25], 0.2, 0.08);
        showPremiumToast(`${candidate.name} moved from ${oldStatus} to ${stage}`, 'success');
        
        recalculateJobPipelines();
        updateSummaryMetrics();
        renderAnalyticsTable();
        renderKanbanBoard();
      }
    });
  });
}

function renderColumnsSelectorDropdowns() {
  const popToggle = document.getElementById('pop-columns-toggle');
  const popTeam = document.getElementById('pop-columns-team');

  if (popToggle) {
    popToggle.innerHTML = '';
    if (AppState.analyticsSubtab === 'jobs-data') {
      const columns = [
        { id: 'id', label: 'Job ID' },
        { id: 'roleName', label: 'Role Name' },
        { id: 'cardName', label: 'Card Name' },
        { id: 'customJobId', label: 'Custom Job ID' },
        { id: 'experienceBand', label: 'Experience Band' },
        { id: 'tags', label: 'Tags' },
        { id: 'createdBy', label: 'Created By' },
        { id: 'collaborators', label: 'Collaborators' },
        { id: 'recruiters', label: 'Recruiters' }
      ];
      columns.forEach(col => {
        const checked = AppState.visibleColumnsAnalyticsJobs.includes(col.id) ? 'checked' : '';
        const label = document.createElement('label');
        label.className = 'columns-popup-item';
        label.innerHTML = `<input type="checkbox" data-col-id="${col.id}" ${checked} /> <span>${col.label}</span>`;
        label.querySelector('input').addEventListener('change', (e) => {
          const isChecked = e.target.checked;
          if (isChecked) {
            if (!AppState.visibleColumnsAnalyticsJobs.includes(col.id)) {
              AppState.visibleColumnsAnalyticsJobs.push(col.id);
            }
          } else {
            AppState.visibleColumnsAnalyticsJobs = AppState.visibleColumnsAnalyticsJobs.filter(id => id !== col.id);
          }
          soundEngine.playClick();
          renderAnalyticsTable();
        });
        popToggle.appendChild(label);
      });
    } else {
      const columns = [
        { id: 'id', label: 'Candidate ID' },
        { id: 'name', label: 'Candidate Name' },
        { id: 'jobApplied', label: 'Job Applied' },
        { id: 'registeredOn', label: 'Registered On' },
        { id: 'status', label: 'Pipeline Stage' },
        { id: 'score', label: 'Match Score' },
        { id: 'actions', label: 'Actions' }
      ];
      columns.forEach(col => {
        const checked = AppState.visibleColumnsAnalyticsCandidates.includes(col.id) ? 'checked' : '';
        const label = document.createElement('label');
        label.className = 'columns-popup-item';
        label.innerHTML = `<input type="checkbox" data-col-id="${col.id}" ${checked} /> <span>${col.label}</span>`;
        label.querySelector('input').addEventListener('change', (e) => {
          const isChecked = e.target.checked;
          if (isChecked) {
            if (!AppState.visibleColumnsAnalyticsCandidates.includes(col.id)) {
              AppState.visibleColumnsAnalyticsCandidates.push(col.id);
            }
          } else {
            AppState.visibleColumnsAnalyticsCandidates = AppState.visibleColumnsAnalyticsCandidates.filter(id => id !== col.id);
          }
          soundEngine.playClick();
          renderAnalyticsTable();
        });
        popToggle.appendChild(label);
      });
    }
  }

  if (popTeam) {
    popTeam.innerHTML = '';
    const columns = [
      { id: 'member', label: 'Team Member' },
      { id: 'designation', label: 'Designation' },
      { id: 'usertype', label: 'Usertype Role' },
      { id: 'registeredOn', label: 'Registered On' },
      { id: 'status', label: 'Status' },
      { id: 'actions', label: 'Actions' }
    ];
    columns.forEach(col => {
      const checked = AppState.visibleColumnsTeam.includes(col.id) ? 'checked' : '';
      const label = document.createElement('label');
      label.className = 'columns-popup-item';
      label.innerHTML = `<input type="checkbox" data-col-id="${col.id}" ${checked} /> <span>${col.label}</span>`;
      label.querySelector('input').addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        if (isChecked) {
          if (!AppState.visibleColumnsTeam.includes(col.id)) {
            AppState.visibleColumnsTeam.push(col.id);
          }
        } else {
          AppState.visibleColumnsTeam = AppState.visibleColumnsTeam.filter(id => id !== col.id);
        }
        soundEngine.playClick();
        renderTeamTable();
      });
      popTeam.appendChild(label);
    });
  }
}

// ==========================================
// RESUME ANALYSIS (AI-powered, Lina)
// ==========================================

const resumeTextCache = {};
const resumeAnalysisCache = {};

function renderResumeStagePaneForJob(candidates, job, container) {
  container.innerHTML = candidates.map(c => {
    const initials = c.name.split(' ').map(n => n[0]).join('');
    return `
      <div class="resume-analysis-card" data-cid="${c.id}">
        <div class="jd-card-header">
          <div class="user-avatar-mini" style="background:rgba(var(--color-gold-rgb),0.12);border-color:rgba(var(--color-gold-rgb),0.4);color:var(--color-gold)">${initials}</div>
          <div class="user-details">
            <span class="cand-name">${c.name}</span>
            <span class="cand-email">${c.email}</span>
          </div>
          <span class="score-badge ra-score-badge" id="badge-${c.id}">${c.score}</span>
        </div>
        <div class="ra-input-section" id="ra-input-${c.id}">
          <div class="ra-upload-zone" id="ra-zone-${c.id}">
            <input type="file" id="ra-file-${c.id}" class="ra-file-input" accept=".pdf,.docx,.txt" />
            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
            <p class="ra-zone-title">Drop resume here</p>
            <p class="ra-zone-sub">PDF · DOCX · TXT — or click to browse</p>
          </div>
          <div class="ra-file-preview ra-hidden" id="ra-preview-${c.id}"></div>
          <a class="ra-paste-toggle" id="ra-paste-toggle-${c.id}" href="#">✎ No file? Paste resume text</a>
          <textarea class="ra-paste-area ra-hidden" id="ra-paste-${c.id}" placeholder="Paste the candidate's resume text here..."></textarea>
          <button class="btn-analyse-resume" id="ra-btn-${c.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Analyse with Lina
          </button>
        </div>
        <div class="ra-result ra-hidden" id="ra-result-${c.id}"></div>
        <div class="jd-card-actions">
          <button class="btn-stage-reject" data-candidate-id="${c.id}">Reject</button>
          <button class="btn-stage-advance" data-candidate-id="${c.id}" data-next-stage="Screening">Advance to Screening →</button>
        </div>
      </div>
    `;
  }).join('');
  bindResumeAnalysisEvents(job);
}

function bindResumeAnalysisEvents(job) {
  document.querySelectorAll('.resume-analysis-card').forEach(card => {
    const cid = card.dataset.cid;
    const zone = document.getElementById(`ra-zone-${cid}`);
    const fileInput = document.getElementById(`ra-file-${cid}`);
    const pasteToggle = document.getElementById(`ra-paste-toggle-${cid}`);
    const pasteArea = document.getElementById(`ra-paste-${cid}`);
    const btn = document.getElementById(`ra-btn-${cid}`);

    if (resumeAnalysisCache[cid]) renderAnalysisResult(cid, resumeAnalysisCache[cid]);

    zone?.addEventListener('click', () => fileInput?.click());
    zone?.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone?.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone?.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) handleResumeFile(cid, e.dataTransfer.files[0]);
    });
    fileInput?.addEventListener('change', () => {
      if (fileInput.files[0]) handleResumeFile(cid, fileInput.files[0]);
    });
    pasteToggle?.addEventListener('click', e => {
      e.preventDefault();
      const nowHidden = pasteArea?.classList.toggle('ra-hidden');
      pasteToggle.textContent = nowHidden ? '✎ No file? Paste resume text' : '✕ Hide paste area';
    });
    btn?.addEventListener('click', () => runResumeAnalysis(cid, job));
  });
}

function handleResumeFile(cid, file) {
  const preview = document.getElementById(`ra-preview-${cid}`);
  const zone = document.getElementById(`ra-zone-${cid}`);
  const reader = new FileReader();
  reader.onload = e => {
    resumeTextCache[cid] = e.target.result;
    zone?.classList.add('has-file');
    if (preview) {
      preview.classList.remove('ra-hidden');
      preview.innerHTML = `
        <div class="ra-file-chip">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span>${file.name}</span>
          <button class="ra-remove-file" data-rcid="${cid}">×</button>
        </div>`;
      preview.querySelector('.ra-remove-file')?.addEventListener('click', () => {
        resumeTextCache[cid] = null;
        preview.classList.add('ra-hidden');
        preview.innerHTML = '';
        zone?.classList.remove('has-file');
        const fi = document.getElementById(`ra-file-${cid}`);
        if (fi) fi.value = '';
      });
    }
  };
  reader.readAsText(file);
}

async function runResumeAnalysis(cid, job) {
  const pasteArea = document.getElementById(`ra-paste-${cid}`);
  const btn = document.getElementById(`ra-btn-${cid}`);
  const resumeText = (resumeTextCache[cid] || '') + '\n' + (pasteArea?.value || '');
  if (!resumeText.trim()) { showPremiumToast('Upload a resume or paste text first.', 'error'); return; }

  const origHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="ra-spinner"></span> Analysing…`;

  const systemPrompt = `You are Lina, an expert ATS resume analyst for IntervieHire. Analyse the provided resume against the job requirements. Respond ONLY with a valid JSON object matching exactly this schema — no extra text, no markdown fences:
{"matchScore":number,"summary":"2-3 sentence professional assessment","experienceYears":"e.g. 4 years","skills":{"detected":["skill1"],"matched":["skill1"],"missing":["skill1"]},"scorecard":{"technical":number,"experience":number,"communication":number,"cultureFit":number},"recommendation":"Advance|Hold|Reject","recommendationReason":"1 sentence reason"}
All scorecard values 0–10. matchScore 0–100.`;

  const userMsg = `Job Title: ${job.cardName}\nRole: ${job.roleName}\nExperience Required: ${job.experienceBand}\nJob Description: ${job.description || '(Not provided)'}\n\n--- RESUME ---\n${resumeText.slice(0, 3500)}`;

  try {
    const raw = await callDeepSeekAPI(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
      true
    );
    const result = JSON.parse(sanitizeJSONResponse(raw));
    resumeAnalysisCache[cid] = result;
    const cand = AppState.candidates.find(c => c.id === cid);
    if (cand) { cand.score = `${result.matchScore}%`; saveStateToLocalStorage(); }
    renderAnalysisResult(cid, result);
    showPremiumToast('Resume analysis complete.', 'success');
  } catch {
    showPremiumToast('Analysis failed — please try again.', 'error');
    btn.disabled = false;
    btn.innerHTML = origHTML;
  }
}

function renderAnalysisResult(cid, result) {
  const resultEl = document.getElementById(`ra-result-${cid}`);
  const inputEl  = document.getElementById(`ra-input-${cid}`);
  const badgeEl  = document.getElementById(`badge-${cid}`);
  if (!resultEl) return;

  if (badgeEl) {
    badgeEl.textContent = `${result.matchScore}%`;
    const c = result.matchScore >= 75 ? '34,197,94' : result.matchScore >= 50 ? '251,191,36' : '239,68,68';
    badgeEl.style.cssText = `background:rgba(${c},0.12);color:rgb(${c});border-color:rgba(${c},0.3);`;
  }

  const recClass = result.recommendation === 'Advance' ? 'advance' : result.recommendation === 'Hold' ? 'hold' : 'reject';
  const recIcon  = result.recommendation === 'Advance' ? '✅' : result.recommendation === 'Hold' ? '⏸' : '❌';

  const scRows = [
    ['Technical',     result.scorecard?.technical     ?? 0],
    ['Experience',    result.scorecard?.experience    ?? 0],
    ['Communication', result.scorecard?.communication ?? 0],
    ['Culture Fit',   result.scorecard?.cultureFit    ?? 0],
  ].map(([lbl, val]) => `
    <div class="sc-bar-row">
      <span class="sc-label">${lbl}</span>
      <div class="sc-bar-track"><div class="sc-bar-fill sc-fill-${recClass}" style="width:${(+val)*10}%"></div></div>
      <span class="sc-val">${(+val).toFixed(1)}</span>
    </div>`).join('');

  const chips = (arr, cls) => (arr || []).map(s => `<span class="skill-chip ${cls}">${s}</span>`).join('');

  resultEl.innerHTML = `
    <div class="ra-result-top">
      <div class="ra-score-ring-wrap">
        <div class="ra-score-ring" style="--score:${result.matchScore}">
          <span class="ra-score-num">${result.matchScore}</span>
          <span class="ra-score-pct">%</span>
        </div>
        <p class="ra-exp-label">~&nbsp;${result.experienceYears}</p>
      </div>
      <div class="ra-rec-block">
        <div class="rec-badge ${recClass}">${recIcon}&nbsp;${result.recommendation}</div>
        <p class="rec-reason">${result.recommendationReason}</p>
      </div>
    </div>
    ${(result.skills?.matched?.length || result.skills?.missing?.length || result.skills?.detected?.length) ? `
    <div class="ra-skills-section">
      ${result.skills?.matched?.length  ? `<div class="ra-skills-row"><span class="rsk-label matched-label">Matched</span><div class="skill-chips-wrap">${chips(result.skills.matched,'matched')}</div></div>` : ''}
      ${result.skills?.missing?.length  ? `<div class="ra-skills-row"><span class="rsk-label missing-label">Missing</span><div class="skill-chips-wrap">${chips(result.skills.missing,'missing')}</div></div>` : ''}
      ${result.skills?.detected?.length ? `<div class="ra-skills-row"><span class="rsk-label detected-label">Detected</span><div class="skill-chips-wrap">${chips(result.skills.detected,'detected')}</div></div>` : ''}
    </div>` : ''}
    <div class="ra-scorecard">
      <p class="ra-sc-title">AI Scorecard</p>
      ${scRows}
    </div>
    <div class="ra-summary-box">
      <span class="ra-summary-label">Lina's Assessment</span>
      <p class="ra-summary-text">"${result.summary}"</p>
    </div>
    <button class="btn-re-analyse" id="ra-re-${cid}">↺ Re-analyse</button>
  `;

  resultEl.classList.remove('ra-hidden');
  inputEl?.classList.add('ra-hidden');

  document.getElementById(`ra-re-${cid}`)?.addEventListener('click', () => {
    resultEl.classList.add('ra-hidden');
    inputEl?.classList.remove('ra-hidden');
    const btn = document.getElementById(`ra-btn-${cid}`);
    if (btn) { btn.disabled = false; btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Analyse with Lina`; }
  });
}

function renderJobDetailPanes(job) {
  const searchVal = document.getElementById('jd-candidate-search').value.trim().toLowerCase();
  
  const jobCandidates = AppState.candidates.filter(c => {
    const matchesJob = c.jobApplied === job.roleName || c.jobApplied === job.cardName;
    if (!matchesJob) return false;
    if (searchVal) {
      return c.name.toLowerCase().includes(searchVal) || c.email.toLowerCase().includes(searchVal);
    }
    return true;
  });

  // 1. Resume pane
  const resumeList = document.getElementById('list-stage-resume');
  if (resumeList) {
    const resumeCands = jobCandidates.filter(c => c.status === 'Resume');
    if (resumeCands.length === 0) {
      resumeList.innerHTML = `
        <div class="jd-empty-pane">
          <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-faint)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
          <p>Resume Analysis — No candidates in this stage</p>
        </div>
      `;
    } else {
      renderResumeStagePaneForJob(resumeCands, job, resumeList);
    }
  }

  // 2. Screening pane
  const screeningList = document.getElementById('list-stage-screening');
  if (screeningList) {
    const screeningCands = jobCandidates.filter(c => c.status === 'Screening');
    if (screeningCands.length === 0) {
      screeningList.innerHTML = `
        <div class="jd-empty-pane">
          <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-faint)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
          <p>Recruiter Screening — No candidates in this stage</p>
        </div>
      `;
    } else {
      screeningList.innerHTML = screeningCands.map(c => `
        <div class="jd-candidate-row-card" data-candidate-id="${c.id}">
          <div class="jd-card-header">
            <div class="user-avatar-mini" style="background-color: var(--color-indigo-dim); border-color: var(--color-indigo); color: var(--color-indigo-light);">${c.name.split(' ').map(n=>n[0]).join('')}</div>
            <div class="user-details">
              <span class="cand-name">${c.name}</span>
              <span class="cand-email">${c.email}</span>
            </div>
            <span class="score-badge indigo">${c.score} match</span>
          </div>
          <div class="jd-card-body">
            <div class="screening-audio-player" data-player-id="${c.id}">
              <button class="btn-player-play" data-play-id="${c.id}">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="play-icon"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="pause-icon" style="display:none;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
              </button>
              <div class="player-wave-bars" data-wave-id="${c.id}">
                <!-- Will be filled programmatically -->
              </div>
              <span class="player-time" data-time-id="${c.id}">0:00 / 0:15</span>
            </div>
            <div class="transcript-box">
              <span class="transcript-label">AI Interview Transcript:</span>
              <p class="transcript-text" data-transcript-id="${c.id}">"Lina: Can you explain how you handle conflicting opinions in project schedules?<br>Candidate: I lay out the technical constraints, compare the alternatives side-by-side using data, and facilitate a consensus meeting."</p>
            </div>
          </div>
          <div class="jd-card-actions">
            <button class="btn-stage-reject" data-candidate-id="${c.id}">Reject</button>
            <button class="btn-stage-advance" data-candidate-id="${c.id}" data-next-stage="Functional">Advance to Functional →</button>
          </div>
        </div>
      `).join('');

      // Populate waves for screening cards
      screeningCands.forEach(c => {
        const waveContainer = document.querySelector(`.player-wave-bars[data-wave-id="${c.id}"]`);
        if (waveContainer) {
          waveContainer.innerHTML = '';
          for (let i = 0; i < 28; i++) {
            const bar = document.createElement('div');
            bar.className = 'player-wave-bar';
            const h = Math.floor(Math.random() * 70 + 20);
            bar.style.height = `${h}%`;
            waveContainer.appendChild(bar);
          }
        }
      });
    }
  }

  // 3. Functional pane
  const functionalList = document.getElementById('list-stage-functional');
  if (functionalList) {
    const functionalCands = jobCandidates.filter(c => c.status === 'Functional');
    if (functionalCands.length === 0) {
      functionalList.innerHTML = `
        <div class="jd-empty-pane">
          <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-faint)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>
          <p>Functional Interview — No candidates in this stage</p>
        </div>
      `;
    } else {
      functionalList.innerHTML = functionalCands.map(c => {
        const review = CandidateReviews[c.id] || CandidateReviews['CAN-8234-EA1'];
        return `
          <div class="jd-candidate-row-card">
            <div class="jd-card-header">
              <div class="user-avatar-mini" style="background-color: var(--color-gold-dim); border-color: var(--color-gold); color: var(--color-gold-light);">${c.name.split(' ').map(n=>n[0]).join('')}</div>
              <div class="user-details">
                <span class="cand-name">${c.name}</span>
                <span class="cand-email">${c.email}</span>
              </div>
              <span class="score-badge gold">${c.score} match</span>
            </div>
            <div class="jd-card-body">
              <div class="code-review-pane">
                <div class="code-header">
                  <span class="file-name">${review.file}</span>
                  <span class="reviewer-tag">Code Evaluator: ${review.reviewer}</span>
                </div>
                <pre class="code-box"><code>${review.code}</code></pre>
                <div class="review-comment">
                  <strong>Kaelen Feedback:</strong>
                  <p>${review.comment}</p>
                </div>
              </div>
            </div>
            <div class="jd-card-actions">
              <button class="btn-stage-reject" data-candidate-id="${c.id}">Reject</button>
              <button class="btn-stage-advance" data-candidate-id="${c.id}" data-next-stage="Hired">Hire Candidate ✓</button>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Bind actions
  const pane = document.getElementById('view-job-detail');
  if (pane) {
    pane.querySelectorAll('.btn-stage-reject').forEach(btn => {
      btn.addEventListener('click', () => {
        const candId = btn.getAttribute('data-candidate-id');
        updateCandidateStatus(candId, 'Rejected');
      });
    });
    
    pane.querySelectorAll('.btn-stage-advance').forEach(btn => {
      btn.addEventListener('click', () => {
        const candId = btn.getAttribute('data-candidate-id');
        const nextStage = btn.getAttribute('data-next-stage');
        updateCandidateStatus(candId, nextStage);
      });
    });

    pane.querySelectorAll('.btn-player-play').forEach(btn => {
      btn.addEventListener('click', () => {
        const candId = btn.getAttribute('data-play-id');
        toggleCardPlayer(candId);
      });
    });
  }
  renderQuestionsPane(job);
}

function updateCandidateStatus(candId, newStatus) {
  const candidate = AppState.candidates.find(c => c.id === candId);
  if (!candidate) return;
  
  const oldStatus = candidate.status;
  candidate.status = newStatus;
  
  if (newStatus === 'Rejected') {
    showPremiumToast(`${candidate.name} has been rejected from the pipeline.`, 'success');
    soundEngine.playChime([392, 293.66], 0.2, 0.1);
  } else if (newStatus === 'Hired') {
    showPremiumToast(`Congratulations! ${candidate.name} has been marked as Hired.`, 'success');
    soundEngine.playChime([523.25, 659.25, 783.99, 1046.50], 0.25, 0.08);
  } else {
    showPremiumToast(`${candidate.name} advanced to ${newStatus}.`, 'success');
    soundEngine.playChime([329.63, 440.00, 523.25], 0.2, 0.08);
  }
  
  recalculateJobPipelines();
  updateSummaryMetrics();
  renderAnalyticsTable();
  
  const activeJob = AppState.jobs.find(j => j.id === AppState.activeJobId);
  if (activeJob) {
    document.getElementById('jd-count-screening').textContent = activeJob.pipeline.screening;
    const funcLabel = activeJob.pipeline.screening > 0
      ? `${activeJob.pipeline.functional} of ${activeJob.pipeline.screening}`
      : activeJob.pipeline.functional;
    document.getElementById('jd-count-functional').textContent = funcLabel;
    
    renderFunnelStages(activeJob);
    renderFunnelInsights(activeJob);
    
    const jobCandidates = AppState.candidates.filter(
      c => c.jobApplied === activeJob.roleName || c.jobApplied === activeJob.cardName
    );
    drawFunnelSVG(activeJob, jobCandidates);
    drawScoreDistributionSVG(activeJob, jobCandidates);
    
    renderJobDetailPanes(activeJob);
  }
  
  if (document.getElementById('jobs-board-container') && document.getElementById('jobs-board-container').style.display !== 'none') {
    renderKanbanBoard();
  } else {
    renderJobCards();
  }
}

function stopActiveCardPlayer() {
  if (activeCardInterval) {
    clearInterval(activeCardInterval);
    activeCardInterval = null;
  }
  if (activeCardPlayerId) {
    const oldId = activeCardPlayerId;
    const playBtn = document.querySelector(`[data-play-id="${oldId}"]`);
    if (playBtn) {
      playBtn.querySelector('.play-icon').style.display = 'block';
      playBtn.querySelector('.pause-icon').style.display = 'none';
    }
    const timeLabel = document.querySelector(`[data-time-id="${oldId}"]`);
    if (timeLabel) timeLabel.textContent = '0:00 / 0:15';
    
    const bars = document.querySelectorAll(`.player-wave-bars[data-wave-id="${oldId}"] .player-wave-bar`);
    bars.forEach(b => {
      b.classList.remove('played');
      b.style.height = `${Math.floor(Math.random() * 70 + 20)}%`;
    });
    activeCardPlayerId = null;
  }
}

function toggleCardPlayer(id) {
  if (activeCardPlayerId === id) {
    clearInterval(activeCardInterval);
    activeCardInterval = null;
    activeCardPlayerId = null;
    const playBtn = document.querySelector(`[data-play-id="${id}"]`);
    if (playBtn) {
      playBtn.querySelector('.play-icon').style.display = 'block';
      playBtn.querySelector('.pause-icon').style.display = 'none';
    }
    soundEngine.playClick();
  } else {
    stopActiveCardPlayer();
    
    activeCardPlayerId = id;
    activeCardTime = 0;
    soundEngine.playChime([440, 554.37], 0.1, 0.05);
    
    const playBtn = document.querySelector(`[data-play-id="${id}"]`);
    if (playBtn) {
      playBtn.querySelector('.play-icon').style.display = 'none';
      playBtn.querySelector('.pause-icon').style.display = 'block';
    }
    
    const timeLabel = document.querySelector(`[data-time-id="${id}"]`);
    const bars = document.querySelectorAll(`.player-wave-bars[data-wave-id="${id}"] .player-wave-bar`);
    
    activeCardInterval = setInterval(() => {
      activeCardTime += 100;
      if (activeCardTime >= cardDuration) {
        stopActiveCardPlayer();
        soundEngine.playChime([523.25, 392], 0.15, 0.08);
        return;
      }
      
      if (timeLabel) {
        const secs = Math.floor(activeCardTime / 1000);
        timeLabel.textContent = `0:${secs.toString().padStart(2, '0')} / 0:15`;
      }
      
      const progress = activeCardTime / cardDuration;
      const activeIndex = Math.floor(progress * bars.length);
      
      bars.forEach((bar, idx) => {
      });
    }, 100);
  }
}

// ============================================================
// DEEPSEEK QUESTIONS GENERATOR & LOCAL STORAGE PERSISTENCE
// ============================================================

let currentStagedQuestions = [];

function saveStateToLocalStorage() {
  localStorage.setItem('IntervieHire_jobs_state', JSON.stringify(AppState.jobs));
}

function loadStateFromLocalStorage() {
  const saved = localStorage.getItem('IntervieHire_jobs_state');
  if (!saved) {
    saveStateToLocalStorage();
    return;
  }
  
  try {
    const parsedJobs = JSON.parse(saved);
    if (!Array.isArray(parsedJobs) || parsedJobs.length === 0) {
      saveStateToLocalStorage();
      return;
    }
    
    // Replace AppState.jobs with parsed jobs from localStorage, ensuring all properties are defined with fallbacks
    AppState.jobs = parsedJobs.map(pj => {
      // Find hardcoded defaults for pipeline or questions if missing
      const hardcodedDefault = pj.id === 'AKRO62EF45E26EA1' ? {
        description: "We are seeking a detail-oriented Government Tender & Proposal Executive to manage and lead the preparation, review, and submission of bids, tenders, and proposals for public sector opportunities. Key duties include analyzing RFP guidelines, checking compliance matrices, and writing clear technical and operational responses.",
        experienceBand: "Upto 2 Years",
        roleName: "Government Tender & Proposal Executive",
        cardName: "Government Tender & Proposal Executive..",
        createdBy: "Devasri",
        pipeline: { total: 3, resume: 0, screening: 2, functional: 1 },
        questions: [
          {
            id: 'q-prop-1',
            type: 'technical',
            question: "Explain the process of drafting a government RFP response. What are the key compliance elements you verify before submission?",
            difficulty: 'intermediate',
            rubric: "Identifies compliance checklists, standard submission formats, and verification protocols.",
            follow_ups: ["How do you handle late updates to tender guidelines?", "What tools do you use for tracking deadline milestones?"]
          },
          {
            id: 'q-prop-2',
            type: 'behavioral',
            question: "Describe a time when you had to meet an extremely tight deadline for a critical proposal. How did you organize your tasks?",
            difficulty: 'beginner',
            rubric: "Mentions prioritization, time management, keeping key stakeholders aligned, and maintaining accuracy under pressure.",
            follow_ups: ["Did you make any errors in that rush?", "What would you do differently next time?"]
          },
          {
            id: 'q-prop-3',
            type: 'situational',
            question: "A key subject matter expert (SME) fails to deliver their input 2 hours before a tender submission deadline. How do you handle this?",
            difficulty: 'advanced',
            rubric: "Proposes logical mitigation strategies like escalation plans, using boilerplate content, or direct intervention to secure crucial technical details.",
            follow_ups: ["How do you prevent this issue in advance?", "How do you communicate the emergency to leadership?"]
          }
        ]
      } : pj.id === 'AKRO62EF45E26DF5' ? {
        description: "We are hiring a Full Stack Developer to design, build, and support high-performance web applications. You will work with React on the frontend, Node.js and Express on the backend, and PostgreSQL for storage. Responsibilities include building responsive dashboards, optimizing latency, and ensuring data consistency across endpoints.",
        experienceBand: "1-4 Years",
        roleName: "Full Stack Developer",
        cardName: "Full Stack Developer Hiring - Demo",
        createdBy: "Devasri",
        pipeline: { total: 1, resume: 0, screening: 0, functional: 1 },
        questions: [
          {
            id: 'q-dev-1',
            type: 'technical',
            question: "Describe the differences between optimistic UI updates and pessimistic UI updates. When would you use each?",
            difficulty: 'intermediate',
            rubric: "Explains user experience vs data consistency, error handling, and rollback logic in state managers.",
            follow_ups: ["How do you handle temporary network failures?", "Can you describe a scenario where optimistic updates fail badly?"]
          },
          {
            id: 'q-dev-2',
            type: 'behavioral',
            question: "Tell me about a time you had a technical disagreement with a team lead or colleague. How was it resolved?",
            difficulty: 'beginner',
            rubric: "Highlights constructive communication, presenting data-backed arguments, testing hypotheses, and committing to the final team decision.",
            follow_ups: ["What did you learn from their perspective?", "Did it affect your working relationship afterwards?"]
          },
          {
            id: 'q-dev-3',
            type: 'situational',
            question: "We are experiencing a sudden spike in database read latency during peak hours. Walk me through your debugging steps.",
            difficulty: 'advanced',
            rubric: "Mentions slow query logs, connection pools, indexing, caching layers (Redis), replica scaling, and server utilization checks.",
            follow_ups: ["How would you explain the downtime to a non-technical manager?", "What long-term safeguards would you set up?"]
          }
        ]
      } : null;

      const fallbackPipeline = hardcodedDefault ? hardcodedDefault.pipeline : { total: 0, resume: 0, screening: 0, functional: 0 };
      const fallbackDesc = hardcodedDefault ? hardcodedDefault.description : "No job description provided.";
      const fallbackQuestions = hardcodedDefault ? hardcodedDefault.questions : [];
      
      return {
        id: pj.id || generateJobId(),
        roleName: pj.roleName || (hardcodedDefault ? hardcodedDefault.roleName : 'Untitled Role'),
        cardName: pj.cardName || pj.roleName || (hardcodedDefault ? hardcodedDefault.cardName : 'Untitled Job'),
        created: pj.created || 'Recently',
        status: pj.status || 'published',
        customJobId: pj.customJobId || '-',
        experienceBand: pj.experienceBand || (hardcodedDefault ? hardcodedDefault.experienceBand : 'Upto 2 Years'),
        createdBy: pj.createdBy || (hardcodedDefault ? hardcodedDefault.createdBy : 'Devasri'),
        description: pj.description || fallbackDesc,
        questions: pj.questions || fallbackQuestions,
        pipeline: pj.pipeline || fallbackPipeline
      };
    });
  } catch (e) {
    console.error("Error loading jobs from localStorage", e);
    // If corrupt, save fresh hardcoded defaults
    saveStateToLocalStorage();
  }
}

async function callDeepSeekAPI(messages, jsonMode = false) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  try {
    const response = await fetch('/api/deepseek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, jsonMode }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API response error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('DeepSeek API call failed:', error);
    throw error;
  }
}

function sanitizeJSONResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
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
      <div class="jd-empty-pane" style="text-align: center; padding: 40px 20px; display: flex; flex-direction: column; align-items: center; gap: 12px; opacity: 0.85;">
        <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-faint)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        <p style="color: var(--color-text-muted); font-size: 0.9rem;">No interview questions defined yet.</p>
        <p style="color: var(--color-text-faint); font-size: 0.8rem; max-width: 320px; margin-top: -6px;">Enter a job description on the left and click "Generate Questions Set" to auto-design a premium interview rubric.</p>
      </div>
    `;
  } else {
    listQuestions.innerHTML = job.questions.map((q, qIndex) => `
      <div class="card-glass jd-question-card" data-q-id="${q.id}" style="margin-bottom: 16px; padding: 16px; border-radius: 12px; border: 1px solid var(--glass-border); transition: var(--spring-fast);">
        <div class="q-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 12px;">
          <span class="q-type-badge ${q.type || 'technical'}" style="padding: 3px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; text-transform: uppercase;">${q.type || 'technical'}</span>
          <select class="q-difficulty-select" data-field="difficulty" style="background: rgba(0,0,0,0.25); border: 1px solid var(--glass-border); color: var(--color-text-primary); border-radius: 6px; padding: 2px 6px; font-size: 0.78rem; font-family: var(--font-body); outline: none;">
            <option value="beginner" ${q.difficulty === 'beginner' ? 'selected' : ''}>Beginner</option>
            <option value="intermediate" ${q.difficulty === 'intermediate' ? 'selected' : ''}>Intermediate</option>
            <option value="advanced" ${q.difficulty === 'advanced' ? 'selected' : ''}>Advanced</option>
          </select>
        </div>
        <div class="q-card-body" style="display: flex; flex-direction: column; gap: 12px;">
          <textarea class="q-question-text" data-field="question" placeholder="Enter question wording..." style="width: 100%; min-height: 50px; background: rgba(0,0,0,0.15); border: 1px solid var(--glass-border); border-radius: 8px; padding: 8px; color: var(--color-text-primary); font-family: var(--font-body); font-size: 0.88rem; line-height: 1.4; resize: vertical; outline: none;"></textarea>
          
          <div class="q-rubric-box" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 8px; padding: 10px;">
            <span class="q-rubric-label" style="font-size: 0.78rem; font-weight: 600; color: var(--color-gold); display: block; margin-bottom: 4px;">Evaluation Rubric:</span>
            <textarea class="q-rubric-text" data-field="rubric" placeholder="What does a good answer sound like?..." style="width: 100%; min-height: 40px; background: transparent; border: none; color: var(--color-text-muted); font-family: var(--font-body); font-size: 0.82rem; line-height: 1.4; resize: vertical; outline: none; padding: 0;"></textarea>
          </div>

          ${q.follow_ups && q.follow_ups.length > 0 ? `
            <div class="q-followups-box">
              <span class="q-followups-label" style="font-size: 0.78rem; font-weight: 600; color: var(--color-text-muted); display: block; margin-bottom: 6px;">Suggested Follow-Ups:</span>
              <ul class="q-followups-list" style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px;">
                ${q.follow_ups.map((f, idx) => `
                  <li style="display: flex; align-items: center; gap: 6px;">
                    <span style="color: var(--color-text-faint); font-size: 0.8rem;">•</span>
                    <input type="text" class="q-followup-input" data-idx="${idx}" value="${f}" style="flex-grow: 1; background: transparent; border: none; border-bottom: 1px dashed rgba(255,255,255,0.1); color: var(--color-text-muted); font-size: 0.82rem; outline: none; padding: 2px 0;" />
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
        <div class="q-card-actions" style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px;">
          <button class="btn-q-delete btn-jd-ghost btn-sm" data-idx="${qIndex}" style="padding: 4px 8px; font-size: 0.75rem; border-color: rgba(239, 68, 68, 0.2); color: #ef4444;" title="Delete this question">Delete</button>
          <button class="btn-q-enhance btn-jd-primary btn-sm" data-idx="${qIndex}" style="padding: 4px 8px; font-size: 0.75rem;" title="Enhance with AI">✨ Enhance</button>
          <button class="btn-q-save btn-jd-ghost btn-sm" data-idx="${qIndex}" style="padding: 4px 8px; font-size: 0.75rem; color: var(--color-gold); border-color: var(--glass-border-gold);" title="Save changes">Save</button>
        </div>
      </div>
    `).join('');

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

    listQuestions.querySelectorAll('.btn-q-save').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'));
        const card = btn.closest('.jd-question-card');
        
        const questionText = card.querySelector('.q-question-text').value.trim();
        const rubricText = card.querySelector('.q-rubric-text').value.trim();
        const difficulty = card.querySelector('.q-difficulty-select').value;
        
        const followUps = [];
        card.querySelectorAll('.q-followup-input').forEach(inp => {
          if (inp.value.trim() !== '') {
            followUps.push(inp.value.trim());
          }
        });
        
        job.questions[idx].question = questionText;
        job.questions[idx].rubric = rubricText;
        job.questions[idx].difficulty = difficulty;
        job.questions[idx].follow_ups = followUps;
        
        saveStateToLocalStorage();
        showPremiumToast("Question changes saved.", "success");
        soundEngine.playChime([392, 523.25], 0.12, 0.1);
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
      const textSpan = newBtnGen.querySelector('.btn-text');
      const loaderSpan = document.createElement('span');
      loaderSpan.innerHTML = `<div class="spinner-mini" style="display:inline-block; width:12px; height:12px; border:2px solid rgba(255,255,255,0.3); border-top-color:#ffffff; border-radius:50%; animation:spin-mini 0.6s linear infinite; margin-right:6px; vertical-align:middle;"></div> Generating...`;
      
      const originalText = textSpan.textContent;
      textSpan.style.display = 'none';
      newBtnGen.appendChild(loaderSpan);
      
      soundEngine.playChime([392, 440], 0.1, 0.1);

      const systemPrompt = `You are a senior hiring manager and domain expert.
Your task is to generate a set of 3 to 5 high-quality interview questions based on the given job description.

Requirements:
- Include different types of questions: technical, behavioral, and situational.
- For each question, provide:
  1. "type": either "technical", "behavioral", or "situational".
  2. "question": a clear, direct, and professional question.
  3. "difficulty": either "beginner", "intermediate", or "advanced".
  4. "rubric": a brief evaluation rubric (what a good answer should include).
  5. "follow_ups": a list of 2 suggested follow-up questions.
- Output ONLY valid JSON starting with { and ending with }. Do not wrap in markdown or add explanations.`;

      try {
        const responseText = await callDeepSeekAPI([
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate questions for this job description:\n\n${desc}` }
        ], true);

        const cleanText = sanitizeJSONResponse(responseText);
        const parsed = JSON.parse(cleanText);
        
        if (parsed && parsed.questions) {
          currentStagedQuestions = parsed.questions.map((q, idx) => ({
            id: `q-gen-${Date.now()}-${idx}`,
            type: q.type || 'technical',
            question: q.question,
            difficulty: q.difficulty || 'intermediate',
            rubric: q.rubric || '',
            follow_ups: q.follow_ups || []
          }));
          
          showStagingArea(job);
        } else {
          throw new Error("Invalid response format. Missing 'questions' array.");
        }
      } catch (err) {
        console.error("Failed to generate questions:", err);
        showPremiumToast("Failed to generate questions. Please verify your prompt or API status.", "error");
      } finally {
        newBtnGen.disabled = false;
        loaderSpan.remove();
        textSpan.style.display = 'inline-block';
      }
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
}

function showStagingArea(job) {
  const stagingArea = document.getElementById('jd-staging-area');
  const stagingList = document.getElementById('staging-questions-list');
  if (!stagingArea || !stagingList) return;
  
  stagingArea.style.display = 'block';
  
  stagingList.innerHTML = currentStagedQuestions.map((q, idx) => `
    <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 10px; margin-bottom: 8px; position: relative;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <span style="font-size:0.7rem; font-weight:700; text-transform:uppercase; color:var(--color-indigo);">${q.type}</span>
        <button class="btn-staging-discard-item" data-idx="${idx}" style="background:none; border:none; color:#ef4444; font-size:0.9rem; cursor:pointer; padding:0 4px;">&times;</button>
      </div>
      <div style="font-size:0.82rem; color:var(--color-text-primary); line-height:1.4;">${q.question}</div>
      <div style="font-size:0.76rem; color:var(--color-text-muted); margin-top:4px; font-style:italic;">Rubric: ${q.rubric}</div>
    </div>
  `).join('');

  stagingList.querySelectorAll('.btn-staging-discard-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'));
      currentStagedQuestions.splice(idx, 1);
      if (currentStagedQuestions.length === 0) {
        stagingArea.style.display = 'none';
      } else {
        showStagingArea(job);
      }
    });
  });

  const btnReplace = document.getElementById('btn-staging-replace');
  const newBtnReplace = btnReplace.cloneNode(true);
  btnReplace.parentNode.replaceChild(newBtnReplace, btnReplace);
  
  newBtnReplace.addEventListener('click', () => {
    job.questions = [...currentStagedQuestions];
    saveStateToLocalStorage();
    stagingArea.style.display = 'none';
    renderQuestionsPane(job);
    showPremiumToast("Interview questions replaced with generated set.", "success");
    soundEngine.playChime([261.63, 392, 523.25], 0.2, 0.08);
  });

  const btnAppend = document.getElementById('btn-staging-append');
  const newBtnAppend = btnAppend.cloneNode(true);
  btnAppend.parentNode.replaceChild(newBtnAppend, btnAppend);
  
  newBtnAppend.addEventListener('click', () => {
    if (!job.questions) job.questions = [];
    job.questions = job.questions.concat(currentStagedQuestions);
    saveStateToLocalStorage();
    stagingArea.style.display = 'none';
    renderQuestionsPane(job);
    showPremiumToast("Generated questions appended to list.", "success");
    soundEngine.playChime([261.63, 329.63, 392, 523.25], 0.2, 0.08);
  });

  const btnCloseStaging = document.getElementById('btn-close-staging');
  const newBtnCloseStaging = btnCloseStaging.cloneNode(true);
  btnCloseStaging.parentNode.replaceChild(newBtnCloseStaging, btnCloseStaging);
  
  newBtnCloseStaging.addEventListener('click', () => {
    stagingArea.style.display = 'none';
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

// ==========================================
// CRYSTAL GLASS OVERDRIVE: DYNAMIC INTERACTIVE ANIMATIONS
// ==========================================
function initCrystalAnimations() {
  // 1. WebGL Fullscreen fluid background shader setup
  const canvas = document.getElementById('crystal-shader-canvas');
  if (canvas) {
    try {
      const container = canvas.parentElement;
      const scene = new THREE.Scene();
      
      // Camera - Full screen plane OrthographicCamera
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      
      // Renderer
      const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance"
      });
      renderer.setSize(container.clientWidth, container.clientHeight);
      // Cap device pixel ratio for smooth performance (60 FPS focus)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      
      // Simple full-screen quad vertex shader
      const vertexShader = `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `;
      
      // Fragment Shader: domain-warped fractal Brownian noise for a liquid fluid glass background
      const fragmentShader = `
        uniform float u_time;
        uniform vec2 u_resolution;
        uniform float u_theme; // 0.0 for dark (purple/blue), 1.0 for light (beige/orange/yellow)
        uniform vec2 u_mouse;
        
        varying vec2 vUv;
        
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f*f*(3.0-2.0*f);
          return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                     mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
        }
        
        float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.5;
          float frequency = 1.0;
          for (int i = 0; i < 4; i++) {
            value += amplitude * noise(p * frequency);
            frequency *= 2.0;
            amplitude *= 0.5;
          }
          return value;
        }
        
        void main() {
          vec2 st = gl_FragCoord.xy / u_resolution.xy;
          
          float aspect = u_resolution.x / u_resolution.y;
          vec2 uv = st;
          uv.x *= aspect;
          
          // Organic drag displacement based on normalized mouse coords
          uv += u_mouse * 0.04;
          
          // Warping Step 1
          vec2 q = vec2(0.0);
          q.x = fbm(uv + 0.08 * u_time);
          q.y = fbm(uv + vec2(1.0) + 0.06 * u_time);
          
          // Warping Step 2
          vec2 r = vec2(0.0);
          r.x = fbm(uv + 1.2 * q + vec2(1.7, 9.2) + 0.12 * u_time);
          r.y = fbm(uv + 1.2 * q + vec2(8.3, 2.8) + 0.09 * u_time);
          
          float f = fbm(uv + 1.1 * r);
          
          // Theme 1 (Dark Mode): Futuristic Purples and Vibrant Cobalt/Sapphire Blues
          vec3 darkBg = vec3(0.031, 0.024, 0.059);     // Deep midnight purple-slate
          vec3 darkPurple = vec3(0.482, 0.184, 0.906); // Neon Violet
          vec3 darkBlue = vec3(0.122, 0.353, 0.941);   // Electric Sapphire Blue
          vec3 darkAccent = vec3(0.247, 0.078, 0.529); // Royal Indigo Accent
          
          vec3 darkColor = mix(darkBg, darkPurple, f);
          darkColor = mix(darkColor, darkBlue, r.x);
          darkColor = mix(darkColor, darkAccent, q.y * 0.4);
          
          // Theme 2 (Light Mode): Modern Soft Beige/Cream and Vibrant Warm Orange/Yellow
          vec3 lightBg = vec3(0.969, 0.961, 0.929);     // Premium warm cream beige
          vec3 lightOrange = vec3(0.973, 0.588, 0.294); // Fluid warm orange
          vec3 lightYellow = vec3(0.980, 0.824, 0.392); // Sunlit soft yellow
          vec3 lightAccent = vec3(0.933, 0.890, 0.804); // Deep beige shadow
          
          vec3 lightColor = mix(lightBg, lightOrange, f * 0.65);
          lightColor = mix(lightColor, lightYellow, r.y * 0.55);
          lightColor = mix(lightColor, lightAccent, q.x * 0.35);
          
          // Smooth crossfade based on active theme uniform (0.0 to 1.0)
          vec3 finalColor = mix(darkColor, lightColor, u_theme);
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `;
      
      const geometry = new THREE.PlaneGeometry(2, 2);
      
      const themeState = {
        value: document.body.classList.contains('light-theme') ? 1.0 : 0.0
      };
      
      const uniforms = {
        u_time: { value: 0.0 },
        u_resolution: { value: new THREE.Vector2(container.clientWidth, container.clientHeight) },
        u_theme: { value: themeState.value },
        u_mouse: { value: new THREE.Vector2(0, 0) }
      };
      
      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        depthWrite: false,
        depthTest: false
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      
      // Mouse tracking interpolators
      let mouseX = 0, mouseY = 0;
      let targetMouseX = 0, targetMouseY = 0;
      
      window.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth) * 2.0 - 1.0;
        mouseY = -(e.clientY / window.innerHeight) * 2.0 + 1.0;
      });
      
      // MutationObserver to animate theme uniform when light-theme class changes
      const themeObserver = new MutationObserver(() => {
        const isLight = document.body.classList.contains('light-theme');
        const targetTheme = isLight ? 1.0 : 0.0;
        if (themeState.value !== targetTheme) {
          gsap.to(themeState, {
            value: targetTheme,
            duration: 1.2,
            ease: "power2.out",
            onUpdate: () => {
              uniforms.u_theme.value = themeState.value;
            }
          });
        }
      });
      themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      
      const clock = new THREE.Clock();
      
      function renderShader() {
        requestAnimationFrame(renderShader);
        
        uniforms.u_time.value = clock.getElapsedTime();
        
        // Easing interpolation for mouse slide inertia
        targetMouseX += (mouseX - targetMouseX) * 0.05;
        targetMouseY += (mouseY - targetMouseY) * 0.05;
        uniforms.u_mouse.value.set(targetMouseX, targetMouseY);
        
        renderer.render(scene, camera);
      }
      
      renderShader();
      
      window.addEventListener('resize', () => {
        renderer.setSize(container.clientWidth, container.clientHeight);
        if (uniforms.u_resolution) {
          uniforms.u_resolution.value.set(container.clientWidth, container.clientHeight);
        }
      });
      
      container.classList.add('has-shader');
      
    } catch (err) {
      console.warn("Crystal shader failed to initialize, falling back to CSS static orbs:", err);
    }
  }

  // 1b. Fallback mouse-drifting background orbs (only runs if WebGL is disabled/failed)
  window.addEventListener('mousemove', (e) => {
    const { clientX, clientY } = e;
    const xPercent = (clientX / window.innerWidth - 0.5) * 60;
    const yPercent = (clientY / window.innerHeight - 0.5) * 60;
    
    const orbs = document.querySelectorAll('.orb');
    if (orbs.length > 0 && (!canvas || !canvas.parentElement.classList.contains('has-shader'))) {
      gsap.to('.orb-1', { x: xPercent * 0.9, y: yPercent * 0.9, duration: 1.8, ease: 'power2.out' });
      gsap.to('.orb-2', { x: -xPercent * 0.7, y: -yPercent * 0.7, duration: 2.2, ease: 'power2.out' });
      gsap.to('.orb-3', { x: xPercent * 0.6, y: -yPercent * 0.6, duration: 2.4, ease: 'power2.out' });
      gsap.to('.orb-4', { x: -xPercent * 0.5, y: yPercent * 0.5, duration: 2.6, ease: 'power2.out' });
    }
  });

  // 2. 3D Card Hover Tilt and Shine Spotlights
  function applyTactileTiltEffects() {
    const cards = document.querySelectorAll(
      '.job-card, .card-metric, .panel-setting, .agent-card, .terminal-box, .table-card, .panel-preview, .sourcing-tab-card'
    );
    
    cards.forEach(card => {
      // Avoid duplicate listener bindings
      if (card.dataset.tiltInitialized) return;
      card.dataset.tiltInitialized = 'true';

      // Set initial variables for gradient highlight (shine spotlight)
      card.style.setProperty('--shine-x', '50%');
      card.style.setProperty('--shine-y', '50%');

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left; 
        const y = e.clientY - rect.top;  
        
        const xc = rect.width / 2;
        const yc = rect.height / 2;
        
        // Tilt limit: 8 degrees for a subtle and high-end feel
        const angleX = -(y - yc) / (rect.height / 8); 
        const angleY = (x - xc) / (rect.width / 8);  
        
        gsap.to(card, {
          rotationX: angleX,
          rotationY: angleY,
          ease: 'power1.out',
          duration: 0.2,
          transformPerspective: 800,
          transformOrigin: 'center center'
        });
        
        card.style.setProperty('--shine-x', `${(x / rect.width) * 100}%`);
        card.style.setProperty('--shine-y', `${(y / rect.height) * 100}%`);
      });
      
      card.addEventListener('mouseleave', () => {
        gsap.to(card, {
          rotationX: 0,
          rotationY: 0,
          ease: 'power2.out',
          duration: 0.5
        });
        card.style.setProperty('--shine-x', '50%');
        card.style.setProperty('--shine-y', '50%');
      });
    });
  }

  applyTactileTiltEffects();

  // Create observer to automatically apply 3D tilt effects on dynamically loaded/rendered cards (like jobs lists)
  const listObserver = new MutationObserver(() => {
    applyTactileTiltEffects();
  });
  const container = document.getElementById('jobs-list-container');
  if (container) {
    listObserver.observe(container, { childList: true, subtree: true });
  }

  // 3. SNAPPY SPRING TABS SWITCHING
  const views = document.querySelectorAll('.dashboard-view');
  const viewObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const view = mutation.target;
        if (view.classList.contains('active-view')) {
          // snappier iOS scale-up and slide-up transition using GSAP Back ease
          gsap.fromTo(view, 
            { opacity: 0, scale: 0.96, y: 15 },
            { 
              opacity: 1, 
              scale: 1, 
              y: 0, 
              duration: 0.5, 
              ease: "back.out(1.1)", // snaps with overshoot nicely
              clearProps: "transform,scale,opacity"
            }
          );
        }
      }
    });
  });
  views.forEach(view => viewObserver.observe(view, { attributes: true, attributeFilter: ['class'] }));
}




