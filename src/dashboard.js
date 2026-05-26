// ==========================================
// AUDIO SYNTHESIZER ENGINE (Synced with main.js)
// ==========================================
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false; // Enabled by default for interactive feedback in dashboard
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
      pipeline: {
        total: 3,
        resume: 0,
        screening: 2,
        functional: 1
      }
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
      pipeline: {
        total: 1,
        resume: 0,
        screening: 0,
        functional: 1
      }
    }
  ],
  
  candidates: [
    {
      id: 'CAN-8234-EA1',
      name: 'Aditya Rana',
      email: 'aditya@interviehire.com',
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
  ]
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
    
    // Build pipeline values
    const resumeVal = job.pipeline.resume === 0 || job.pipeline.resume === null ? '-' : job.pipeline.resume;
    const screeningVal = job.pipeline.screening === 0 || job.pipeline.screening === null ? '-' : job.pipeline.screening;
    const functionalVal = job.pipeline.functional === 0 || job.pipeline.functional === null ? '-' : job.pipeline.functional;

    card.innerHTML = `
      <div class="job-card-header">
        <div class="job-card-title-area">
          <h3 class="job-title">${job.cardName}</h3>
          <span class="job-meta-pill">Role: ${job.roleName}</span>
        </div>
        <span class="status-badge ${job.status}">
          <span class="status-badge-dot"></span>
          ${job.status.charAt(0).toUpperCase() + job.status.slice(1)}
        </span>
      </div>
      
      <div class="job-card-details">
        <div class="detail-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          <span>Created: ${job.created}</span>
        </div>
        <div class="detail-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          <span>Experience: ${job.experienceBand}</span>
        </div>
      </div>

      <div class="pipeline-flow">
        <div class="pipeline-step step-total">
          <span class="step-label">Total</span>
          <span class="step-val">${job.pipeline.total}</span>
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
          <div class="author-tag">${job.createdBy.charAt(0)}</div>
          <span class="author-meta">${job.createdBy} (me) // <a href="#" class="author-link-doc" onclick="event.stopPropagation()">Job Description</a></span>
        </div>
        <span class="card-responses-cta">
          View Responses
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </span>
      </div>
    `;

    card.addEventListener('click', () => {
      navigateToJobDetail(job.id);
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
    headers.innerHTML = `
      <th class="sortable" data-sort="id">Job ID <span class="arrow">${AppState.jobsSortKey === 'id' ? (AppState.jobsSortAsc ? '↑' : '↓') : '↕'}</span></th>
      <th class="sortable" data-sort="role">Role Name <span class="arrow">${AppState.jobsSortKey === 'role' ? (AppState.jobsSortAsc ? '↑' : '↓') : '↕'}</span></th>
      <th class="sortable" data-sort="card">Card Name <span class="arrow">${AppState.jobsSortKey === 'card' ? (AppState.jobsSortAsc ? '↑' : '↓') : '↕'}</span></th>
      <th>Custom Job ID</th>
      <th>Experience Band</th>
      <th>Tags</th>
      <th>Job Created By</th>
      <th>Collaborators</th>
      <th>Recruiters</th>
    `;

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
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--color-text-muted); padding: 32px;">No job data matching query</td></tr>`;
      return;
    }

    list.forEach(job => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="cell-mono">${job.id}</td>
        <td><strong>${job.roleName}</strong></td>
        <td>${job.cardName}</td>
        <td>${job.customJobId}</td>
        <td>${job.experienceBand}</td>
        <td style="color: var(--color-text-faint);">-</td>
        <td>${job.createdBy}</td>
        <td style="color: var(--color-text-faint);">-</td>
        <td style="color: var(--color-text-faint);">-</td>
      `;
      tbody.appendChild(tr);
    });

  } else {
    // Candidates data headers
    headers.innerHTML = `
      <th>Candidate ID</th>
      <th>Candidate Name</th>
      <th>Job Applied</th>
      <th>Registered On</th>
      <th>Pipeline Stage</th>
      <th>Match Score</th>
      <th>Actions</th>
    `;

    // Filter Candidates by search
    let list = [...AppState.candidates];
    if (searchVal) {
      list = list.filter(c => c.name.toLowerCase().includes(searchVal) || c.email.toLowerCase().includes(searchVal) || c.jobApplied.toLowerCase().includes(searchVal));
    }

    document.getElementById('analytics-table-showing').textContent = `Showing 1-${list.length} of ${list.length}`;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--color-text-muted); padding: 32px;">No candidates matching query</td></tr>`;
      return;
    }

    list.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="cell-mono">${c.id}</td>
        <td>
          <div class="user-cell">
            <div class="user-avatar-mini">${c.name.split(' ').map(n => n[0]).join('')}</div>
            <div class="user-details">
              <span style="font-weight: 600;">${c.name}</span>
              <span class="user-email-mini">${c.email}</span>
            </div>
          </div>
        </td>
        <td>${c.jobApplied}</td>
        <td class="cell-mono">${c.registeredOn}</td>
        <td>
          <span class="badge-role ${c.status === 'Screening' ? 'recruiter' : 'interviewer'}">
            <span class="badge-role-icon"></span>
            ${c.status}
          </span>
        </td>
        <td>
          <strong style="color: var(--color-gold); text-shadow: 0 0 8px var(--color-gold-glow); font-family: var(--font-mono);">${c.score}</strong>
        </td>
        <td>
          <button class="table-btn-action" title="View Full Report">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
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

  if (filteredTeam.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--color-text-muted); padding: 32px;">No team members matching criteria</td></tr>`;
    return;
  }

  filteredTeam.forEach(member => {
    const tr = document.createElement('tr');
    
    // Status styles
    let statusClass = 'published';
    if (member.status === 'Invited') statusClass = 'draft';
    
    tr.innerHTML = `
      <td>
        <div class="user-cell">
          <div class="user-avatar-mini" style="background-color: var(--color-gold-dim); border-color: var(--color-gold); color: var(--color-gold-light);">${member.name.charAt(0)}</div>
          <div class="user-details">
            <span style="font-weight: 600;">${member.name} ${member.name === 'Devasri' ? '(me)' : ''}</span>
            <span class="user-email-mini">${member.email}</span>
          </div>
        </div>
      </td>
      <td>${member.designation}</td>
      <td>
        <span class="badge-role ${member.usertype === 'Recruiter' ? 'recruiter' : (member.usertype === 'Interviewer' ? 'interviewer' : '')}">
          <span class="badge-role-icon"></span>
          ${member.usertype}
        </span>
      </td>
      <td class="cell-mono">${member.registeredOn}</td>
      <td>
        <span class="status-badge ${statusClass}">
          <span class="status-badge-dot"></span>
          ${member.status}
        </span>
      </td>
      <td>
        <button class="table-btn-action" style="color: var(--color-orange);" title="Deactivate Member" ${member.name === 'Devasri' ? 'disabled style="opacity: 0.2; cursor: not-allowed;"' : ''}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
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
function openDrawer(drawerType) {
  const overlay = document.getElementById('drawer-backdrop');
  overlay.classList.add('active');

  soundEngine.playChime([392.00, 523.25], 0.12, 0.1);

  if (drawerType === 'job') {
    document.getElementById('drawer-job').classList.add('active');
  } else if (drawerType === 'member') {
    document.getElementById('drawer-member').classList.add('active');
  }
}

function closeDrawers() {
  document.getElementById('drawer-backdrop').classList.remove('active');
  document.getElementById('drawer-job').classList.remove('active');
  document.getElementById('drawer-member').classList.remove('active');
  
  const reportDrawer = document.getElementById('drawer-report');
  if (reportDrawer) {
    reportDrawer.classList.remove('active');
    reportDrawer.style.right = '-540px';
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
    filename = "interviehire_jobs_export.csv";
  } else if (dataType === 'candidates') {
    csvContent += "Candidate ID,Name,Email,Job Applied,Status,Score,Registered On\n";
    AppState.candidates.forEach(c => {
      csvContent += `"${c.id}","${c.name}","${c.email}","${c.jobApplied}","${c.status}","${c.score}","${c.registeredOn}"\n`;
    });
    filename = "interviehire_candidates_export.csv";
  } else if (dataType === 'team') {
    csvContent += "Team Member,Email,Designation,Usertype,Registered On,Status\n";
    AppState.team.forEach(t => {
      csvContent += `"${t.name}","${t.email}","${t.designation}","${t.usertype}","${t.registeredOn}","${t.status}"\n`;
    });
    filename = "interviehire_team_export.csv";
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
    return `<code>[${new Date().toLocaleTimeString()}] Aria:</code> Analysed resume profile for ${name}. Match index: ${(80 + Math.random()*19).toFixed(0)}%.`;
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
    return `<code>[${new Date().toLocaleTimeString()}] Aria:</code> Correlating candidates index for ${job}.`;
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
    response = `<code>[${new Date().toLocaleTimeString()}] Aria:</code> Filtered database matches. Identified candidates within desired experience and role configurations.`;
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
  const funcLabel = job.pipeline.screening > 0
    ? `${job.pipeline.functional} of ${job.pipeline.screening}`
    : job.pipeline.functional;
  document.getElementById('jd-count-functional').textContent = funcLabel;

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
      ${s.conv !== null ? `<div class="jds-conv">${s.conv}% conversion</div>` : ''}
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

  const dividers = pts.slice(1, -1).map(p =>
    `<line x1="${p.lx - 14}" y1="${p.y}" x2="${p.rx + 14}" y2="${p.y}"
      stroke="rgba(255,255,255,0.065)" stroke-width="1" stroke-dasharray="4 3"/>`
  ).join('');

  svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svgEl.innerHTML = `
    <defs>
      <linearGradient id="jd-gp" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f472b6" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#9d174d" stop-opacity="0.7"/>
      </linearGradient>
      <linearGradient id="jd-gg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#34d399" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#064e3b" stop-opacity="0.7"/>
      </linearGradient>
    </defs>
    ${dividers}
    ${pinkSegs.map(d => `<path d="${d}" fill="url(#jd-gp)"/>`).join('')}
    ${greenSegs.map(d => `<path d="${d}" fill="url(#jd-gg)"/>`).join('')}
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

  const yTicks = [0, 25, 50, 75, 100];
  const yLines = yTicks.map(v => {
    const y = padT + chartH - (v / 100) * chartH;
    return `
      <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"
        stroke="rgba(255,255,255,0.045)" stroke-width="1"/>
      <text x="${padL - 6}" y="${y + 3.5}" text-anchor="end"
        fill="rgba(255,255,255,0.3)" font-size="9" font-family="sans-serif">${v}%</text>`;
  }).join('');

  const bars = percs.map((p, i) => {
    const barH = Math.max((p / 100) * chartH, p > 0 ? 2 : 0);
    const x = padL + i * gap + (gap - barW) / 2;
    const y = padT + chartH - barH;
    return `
      <rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="#6366f1" rx="3" opacity="0.9"/>
      ${p > 0 ? `<text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle"
        fill="rgba(255,255,255,0.65)" font-size="9.5" font-family="sans-serif">${Math.round(p)}%</text>` : ''}
      <text x="${x + barW / 2}" y="${H - padB + 14}" text-anchor="middle"
        fill="rgba(255,255,255,0.35)" font-size="9" font-family="sans-serif">${buckets[i]}</text>`;
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
      openDrawer('job');
    }
  });

  // C. Drawer Close actions
  document.getElementById('drawer-backdrop').addEventListener('click', closeDrawers);
  document.getElementById('btn-close-drawer-job').addEventListener('click', closeDrawers);
  document.getElementById('btn-close-drawer-member').addEventListener('click', closeDrawers);
  
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
  createJobForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const cardName = document.getElementById('job-title-input').value;
    const roleName = document.getElementById('job-role-input').value;
    const expBand = document.getElementById('job-experience-input').value;
    let customId = document.getElementById('job-custom-id').value;
    
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
    statusLink.textContent = `interviehire.com/careers/${domainName} ↗`;
    statusLink.href = `https://interviehire.com/careers/${domainName}`;
    
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

  // Columns toggles buttons mock actions
  document.getElementById('btn-columns-toggle').addEventListener('click', () => {
    soundEngine.playClick();
    alert('Column configuration interface details can be linked to your role custom database.');
  });
  document.getElementById('btn-columns-team').addEventListener('click', () => {
    soundEngine.playClick();
    alert('Column configuration details can be linked to your team custom database.');
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
  
  if (btnThemeToggle) {
    const savedTheme = localStorage.getItem('interviehire-theme');
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
      localStorage.setItem('interviehire-theme', themeVal);
      if (careerThemeSelect) {
        careerThemeSelect.value = themeVal;
      }
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
        localStorage.setItem('interviehire-theme', shouldBeLight ? 'light' : 'dark');
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

  // Initial Load Actions
  renderJobCards();
  startSwarmLogs();

  // Initialize Crystal Glass Sliding Tab Pills
  initSlidingPills();

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
  const tracks = document.querySelectorAll('.sidebar-nav ul, .filter-options, .table-tabs, #team-status-tabs, .report-tabs, .jd-tabs, .sub-nav');
  tracks.forEach(track => updateSlidingPill(track));
}

function initSlidingPills() {
  const tracks = document.querySelectorAll('.sidebar-nav ul, .filter-options, .table-tabs, #team-status-tabs, .report-tabs, .jd-tabs, .sub-nav');
  
  tracks.forEach(track => {
    // Initial paint
    updateSlidingPill(track);
    
    // Auto-listen to click events within track
    track.addEventListener('click', (e) => {
      const isTab = e.target.closest('.nav-item, .filter-tab, .table-tab-btn, .report-tab-btn, .jd-tab, .sub-nav li');
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

