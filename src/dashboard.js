import * as THREE_import from 'three';
import { gsap } from 'gsap';
import { SoundEngine, soundEngine } from './dashboard/sound.js';
import { AppState } from './dashboard/state.js';
import { CandidateVettingDetails, activeCandidateSubTabs, getCandidateVettingDetails } from './dashboard/data.js';
import { extractTextFromResumeFile, checkAllResumesDone } from './dashboard/resume-parser.js';
import { addCandidateToManualQueue, removeCandidateFromQueue, renderManualQueue, importManualQueue } from './dashboard/queue.js';
import { initKanbanDragAndDrop, renderColumnsSelectorDropdowns } from './dashboard/kanban.js';
import { resumeTextCache, resumeIdentityCache, resumeAnalysisCache, reportChatCache, cacheResumeTextAndIdentity, refreshResumeCandidateRowIdentity, generateAutoResumeAnalysis, renderResumeStagePaneForJob, bindResumeAnalysisEvents, extractNameFromResumeText, handleResumeFile, generateSyntheticResume, isGarbageText, extractExperienceYearsFromText, runResumeAnalysis, renderAnalysisResult, runBulkResumeAnalysis, toggleResumeCriteriaEdit } from './dashboard/resume-analysis.js';
import { openScheduleModal, buildFilterDropdown, applyStageFilters, hasActiveFilters } from './dashboard/filters.js';
import { renderJobDetailPanes, updateCandidateStatus } from './dashboard/pipeline.js';

// Ensure THREE is globally accessible but shadow it in the init function
if (typeof window !== 'undefined') {
  window.THREE = THREE_import;
}

export function initDashboardPage() {
  const controller = new AbortController();
  const { signal } = controller;

  window.AppState = AppState;

  const activeAnimationFrames = new Set();
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame.bind(globalThis);
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame.bind(globalThis);
  
  function requestAnimationFrame(callback) {
    const id = originalRequestAnimationFrame((timestamp) => {
      activeAnimationFrames.delete(id);
      callback(timestamp);
    });
    activeAnimationFrames.add(id);
    return id;
  }
  
  function cancelAnimationFrame(id) {
    activeAnimationFrames.delete(id);
    originalCancelAnimationFrame(id);
  }

  const activeRenderers = new Set();
  const THREE = {
    ...THREE_import,
    WebGLRenderer: class extends THREE_import.WebGLRenderer {
      constructor(...args) {
        super(...args);
        activeRenderers.add(this);
      }
      dispose() {
        activeRenderers.delete(this);
        super.dispose();
      }
    }
  };

  const activeObservers = new Set();
  class MutationObserver extends globalThis.MutationObserver {
    constructor(...args) {
      super(...args);
      activeObservers.add(this);
    }
    disconnect() {
      activeObservers.delete(this);
      super.disconnect();
    }
  }

  const document = new Proxy(globalThis.document, {
    get(target, prop) {
      if (prop === 'addEventListener') {
        return (type, listener, options) => {
          if (type === 'DOMContentLoaded') {
            // Trigger immediately since DOM is already parsed/hydrated
            setTimeout(listener, 0);
            return;
          }
          const opts = typeof options === 'object' ? { signal, ...options } : { signal };
          target.addEventListener(type, listener, opts);
        };
      }
      const val = target[prop];
      return typeof val === 'function' ? val.bind(target) : val;
    }
  });

  const window = new Proxy(globalThis.window, {
    get(target, prop) {
      if (prop === 'addEventListener') {
        return (type, listener, options) => {
          const opts = typeof options === 'object' ? { signal, ...options } : { signal };
          target.addEventListener(type, listener, opts);
        };
      }
      const val = target[prop];
      return typeof val === 'function' ? val.bind(target) : val;
    }
  });

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
        <div class="job-card-header-actions">
          <span class="status-badge ${status}">
            <span class="status-badge-dot"></span>
            ${status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
          <button class="btn-job-kebab" data-job-id="${jobId}" onclick="event.stopPropagation(); toggleJobKebab(this);" title="Job actions" aria-label="Job actions">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
          </button>
          <div class="job-kebab-dropdown" data-job-id="${jobId}" onclick="event.stopPropagation();" onpointerdown="event.stopPropagation();">
            <button class="kebab-item" onclick="event.stopPropagation(); handleJobKebab('${jobId}', 'edit-name')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              Edit Posting
            </button>
            <button class="kebab-item" onclick="event.stopPropagation(); handleJobKebab('${jobId}', 'view-flow')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Configure Job Flow
            </button>
            <button class="kebab-item" onclick="event.stopPropagation(); handleJobKebab('${jobId}', 'add-candidates')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              Add Candidates
            </button>
            <button class="kebab-item" onclick="event.stopPropagation(); handleJobKebab('${jobId}', 'career-page')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              ${job.listedOnCareer ? 'Remove from Career Page' : 'Publish to Career Page'}
            </button>
            <button class="kebab-item" onclick="event.stopPropagation(); handleJobKebab('${jobId}', 'duplicate')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Duplicate as Draft
            </button>
            <button class="kebab-item" onclick="event.stopPropagation(); handleJobKebab('${jobId}', 'settings')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Question Studio
            </button>
            <div class="kebab-divider"></div>
            <button class="kebab-item ${status === 'archived' ? '' : 'kebab-item-danger'}" onclick="event.stopPropagation(); handleJobKebab('${jobId}', '${status === 'archived' ? 'unarchive' : 'archive'}')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
              ${status === 'archived' ? 'Unarchive' : 'Archive'}
            </button>
            <button class="kebab-item kebab-item-danger" onclick="event.stopPropagation(); handleJobKebab('${jobId}', 'delete')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              Delete Posting
            </button>
          </div>
        </div>
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
          <span class="step-val">${pipeline.total || 0}</span>
        </div>
        ${(job.pipelineConfig?.resumeAnalysis?.enabled !== false) ? `
          <span class="pipeline-arrow">→</span>
          <div class="pipeline-step step-resume">
            <span class="step-label">Resume</span>
            <span class="step-val">${resumeVal}</span>
          </div>
        ` : ''}
        ${(job.pipelineConfig?.recruiterScreening?.enabled !== false) ? `
          <span class="pipeline-arrow">→</span>
          <div class="pipeline-step step-screening">
            <span class="step-label">Screening</span>
            <span class="step-val">${screeningVal}</span>
          </div>
        ` : ''}
        ${(job.pipelineConfig?.functionalInterview?.enabled !== false) ? `
          <span class="pipeline-arrow">→</span>
          <div class="pipeline-step step-functional">
            <span class="step-label">Functional</span>
            <span class="step-val">${functionalVal}</span>
          </div>
        ` : ''}
      </div>

      <div class="job-card-footer">
        <div class="author-info">
          <div class="author-tag">${createdBy.charAt(0)}</div>
          <span class="author-meta">${createdBy} (me) // <a href="#" class="author-link-doc" onclick="event.stopPropagation(); openJobDescriptionDrawer('${jobId}')">Job Description</a></span>
        </div>
        <button class="card-flow-cta" onclick="event.stopPropagation(); openJobFlowView('${jobId}');">
          Job Flow
        </button>
        <span class="card-responses-cta">
          View Responses
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </span>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.job-card-header-actions, .card-flow-cta, .author-link-doc')) return;
      navigateToJobDetail(jobId);
    });

    container.appendChild(card);
  });
}

function renderJobListView() {
  const container = document.getElementById('jobs-board-container');
  if (!container) return;
  container.innerHTML = '';

  const filteredJobs = AppState.jobs.filter(job => {
    if (AppState.jobsFilter !== 'all' && job.status !== AppState.jobsFilter) return false;
    if (AppState.globalSearch) {
      const query = AppState.globalSearch.toLowerCase();
      return job.roleName.toLowerCase().includes(query) || job.id.toLowerCase().includes(query);
    }
    return true;
  });

  if (filteredJobs.length === 0) {
    container.innerHTML = '<div class="empty-state card-glass" style="padding:32px;text-align:center;"><p class="type-caption">No jobs match your filters.</p></div>';
    return;
  }

  const header = document.createElement('div');
  header.className = 'job-list-row job-list-header';
  header.innerHTML = `
    <span class="jl-col jl-title">Job Title</span>
    <span class="jl-col jl-status">Status</span>
    <span class="jl-col jl-created">Created</span>
    <span class="jl-col jl-total">Total</span>
    <span class="jl-col jl-resume">Resume</span>
    <span class="jl-col jl-screening">Screening</span>
    <span class="jl-col jl-functional">Functional</span>
    <span class="jl-col jl-action"></span>`;
  container.appendChild(header);

  filteredJobs.forEach(job => {
    const row = document.createElement('div');
    row.className = 'job-list-row';
    const p = job.pipeline || { total: 0, resume: 0, screening: 0, functional: 0 };
    const statusLabel = (job.status || 'published').charAt(0).toUpperCase() + (job.status || 'published').slice(1);
    row.innerHTML = `
      <span class="jl-col jl-title">${job.cardName || job.roleName}</span>
      <span class="jl-col jl-status"><span class="status-badge ${job.status || 'published'}"><span class="status-badge-dot"></span>${statusLabel}</span></span>
      <span class="jl-col jl-created">${job.created || '-'}</span>
      <span class="jl-col jl-total">${p.total}</span>
      <span class="jl-col jl-resume">${(job.pipelineConfig?.resumeAnalysis?.enabled !== false) ? (p.resume || '-') : '—'}</span>
      <span class="jl-col jl-screening">${(job.pipelineConfig?.recruiterScreening?.enabled !== false) ? (p.screening || '-') : '—'}</span>
      <span class="jl-col jl-functional">${(job.pipelineConfig?.functionalInterview?.enabled !== false) ? (p.functional || '-') : '—'}</span>
      <span class="jl-col jl-action"><button class="btn-jd-ghost btn-sm" style="font-size:0.72rem;">View</button></span>`;
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => navigateToJobDetail(job.id));
    container.appendChild(row);
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
    if (AppState.analyticsJobStatusFilter?.length > 0) {
      list = list.filter(j => AppState.analyticsJobStatusFilter.includes(j.status));
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

    let list = filterCandidatesByDateRange(AppState.candidates);
    if (searchVal) {
      list = list.filter(c => c.name.toLowerCase().includes(searchVal) || c.email.toLowerCase().includes(searchVal) || c.jobApplied.toLowerCase().includes(searchVal));
    }
    if (AppState.analyticsCandStageFilter?.length > 0) {
      list = list.filter(c => AppState.analyticsCandStageFilter.includes(c.status));
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
        const nextStage = c.status === 'Resume' ? 'Screening' : c.status === 'Screening' ? 'Functional' : c.status === 'Functional' ? 'Hired' : null;
        cellsHtml += `
          <td>
            <div style="display:flex;gap:6px;align-items:center;justify-content:center;">
              <button class="table-btn-action btn-view-report-from-table" data-candidate-id="${c.id}" title="View Full Report">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </button>
              ${nextStage ? `<button class="btn-stage-advance btn-tbl-advance" data-candidate-id="${c.id}" data-next-stage="${nextStage}" title="Advance to ${nextStage}" style="padding:4px 8px;font-size:0.7rem;">Advance</button>` : ''}
              ${c.status !== 'Hired' && c.status !== 'Rejected' ? `<button class="btn-stage-reject btn-tbl-reject" data-candidate-id="${c.id}" title="Reject candidate" style="padding:4px 8px;font-size:0.7rem;">Reject</button>` : ''}
            </div>
          </td>
        `;
      }
      
      tr.innerHTML = cellsHtml;
      tbody.appendChild(tr);
    });
    
    tbody.querySelectorAll('.btn-view-report-from-table').forEach(btn => {
      btn.addEventListener('click', () => {
        const candId = btn.getAttribute('data-candidate-id');
        openCandidateReport(candId);
      });
    });

    tbody.querySelectorAll('.btn-tbl-advance').forEach(btn => {
      btn.addEventListener('click', () => {
        const candId = btn.getAttribute('data-candidate-id');
        const nextStage = btn.getAttribute('data-next-stage');
        updateCandidateStatus(candId, nextStage);
        renderAnalyticsTable();
      });
    });

    tbody.querySelectorAll('.btn-tbl-reject').forEach(btn => {
      btn.addEventListener('click', () => {
        const candId = btn.getAttribute('data-candidate-id');
        updateCandidateStatus(candId, 'Rejected');
        renderAnalyticsTable();
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
function parseFuzzyDate(str) {
  if (!str) return null;
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  const m = str.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
  if (m) return new Date(`${m[2]} ${m[1]}, ${m[3]}`);
  const m2 = str.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (m2) return new Date(`${m2[1]} ${m2[2]}, ${m2[3]}`);
  return null;
}

function getDateRangeBounds() {
  const now = new Date();
  if (AppState.dateRange === 'custom') {
    const from = document.getElementById('date-from')?.value || document.getElementById('jd-date-from')?.value || AppState.customDateFrom;
    const to = document.getElementById('date-to')?.value || document.getElementById('jd-date-to')?.value || AppState.customDateTo;
    return { start: from ? new Date(from) : null, end: to ? new Date(to + 'T23:59:59') : null };
  }
  if (AppState.dateRange === 'all') return { start: null, end: null };
  const days = { '7d': 7, '30d': 30, '90d': 90 }[AppState.dateRange] || 7;
  const start = new Date(now); start.setDate(start.getDate() - days);
  return { start, end: now };
}

function applyDateRangeGlobally() {
  const { start, end } = getDateRangeBounds();
  const rangeLabel = AppState.dateRange === 'all' ? 'All Time' :
    AppState.dateRange === 'custom' ? 'Custom range' :
    AppState.dateRange === '7d' ? 'Last 7 days' :
    AppState.dateRange === '30d' ? 'Last 30 days' : 'Last 90 days';

  recalculateJobPipelines();
  updateSummaryMetrics();
  renderAnalyticsTable();
  renderJobCards();

  const activeJob = AppState.jobs.find(j => j.id === AppState.activeJobId);
  if (activeJob) {
    const jobCandidates = filterCandidatesByDateRange(
      AppState.candidates.filter(c => c.jobApplied === activeJob.roleName || c.jobApplied === activeJob.cardName)
    );
    drawFunnelSVG(activeJob, jobCandidates);
    drawScoreDistributionSVG(activeJob, jobCandidates);
    renderJobDetailPanes(activeJob);
  }

  showPremiumToast(`${rangeLabel} — showing ${filterCandidatesByDateRange(AppState.candidates).length} of ${AppState.candidates.length} candidates.`, 'success');
}

function filterCandidatesByDateRange(candidates) {
  const { start, end } = getDateRangeBounds();
  if (!start && !end) return candidates;
  return candidates.filter(c => {
    const d = parseFuzzyDate(c.registeredOn);
    if (!d) return true;
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });
}

function updateSummaryMetrics() {
  const filtered = filterCandidatesByDateRange(AppState.candidates);

  const totalApplicants = filtered.length;
  const resumeCount = filtered.filter(c => c.status === 'Resume').length;
  const screeningCount = filtered.filter(c => c.status === 'Screening').length;
  const functionalCount = filtered.filter(c => c.status === 'Functional').length;

  document.getElementById('stat-total-applicants').textContent = totalApplicants;
  document.getElementById('stat-resume-analysis').textContent = resumeCount;
  document.getElementById('stat-recruiter-screening').textContent = screeningCount;
  document.getElementById('stat-functional-interview').textContent = functionalCount;

  const bySource = { 'Career Page': 0, 'Bulk Upload': 0, 'Scheduled': 0, 'Direct Link': 0, 'ATS': 0 };
  filtered.forEach(c => { if (bySource[c.source] !== undefined) bySource[c.source]++; });

  const appPills = document.querySelectorAll('.card-metric:nth-child(1) .m-pill .v');
  if (appPills.length >= 4) {
    appPills[0].textContent = bySource['Career Page'];
    appPills[1].textContent = bySource['Bulk Upload'];
    appPills[2].textContent = bySource['Scheduled'];
    appPills[3].textContent = bySource['Direct Link'];
  }

  const resPills = document.querySelectorAll('.card-metric:nth-child(2) .m-pill .v');
  if (resPills.length >= 3) {
    const analysed = filtered.filter(c => c.status === 'Resume' && c.score !== '—').length;
    resPills[0].textContent = analysed;
    resPills[1].textContent = filtered.filter(c => c.status === 'Screening' || c.status === 'Functional').length;
    resPills[2].textContent = 0;
  }

  const scrPills = document.querySelectorAll('.card-metric:nth-child(3) .m-pill .v');
  if (scrPills.length >= 4) {
    const attempted = filtered.filter(c => c.status === 'Screening' && c.interviewStatus === 'Completed').length;
    const scheduled = filtered.filter(c => c.status === 'Screening' && c.interviewStatus !== 'Completed').length;
    scrPills[0].textContent = attempted;
    scrPills[1].textContent = scheduled;
    scrPills[2].textContent = 0;
    scrPills[3].textContent = 0;
  }

  const funPills = document.querySelectorAll('.card-metric:nth-child(4) .m-pill .v');
  if (funPills.length >= 4) {
    const attempted = filtered.filter(c => c.status === 'Functional' && c.interviewStatus === 'Completed').length;
    const scheduled = filtered.filter(c => c.status === 'Functional' && c.interviewStatus !== 'Completed').length;
    funPills[0].textContent = attempted;
    funPills[1].textContent = scheduled;
    funPills[2].textContent = 0;
    funPills[3].textContent = 0;
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
  toggleHeaderElementsForJobFlow(false);

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
      appendAriaMessage(`Great! I've created "${parsed.roleName}". Now generating your screening criteria, interview questions, and pipeline — hang tight...`, 'aria');
      soundEngine.playChime([329.63, 392, 523.25], 0.15, 0.08);

      try {
        await enrichJobWithAI(newJob, parsed.description);
        appendAriaMessage(`Done! Your full interview pipeline is ready. Taking you there now...`, 'aria');
        soundEngine.playChime([523.25, 659.25, 783.99], 0.2, 0.08);
        setTimeout(() => openJobFlowView(newJob.id, true), 1200);
      } catch (enrichErr) {
        console.error('Enrichment failed:', enrichErr);
        appendAriaMessage(`Job created, but I couldn't generate the full pipeline. You can configure it manually.`, 'aria');
        setTimeout(() => openJobFlowView(newJob.id, true), 1200);
      }
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
let createJobUploadedFile = null;

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

  if (subtabId === 'settings-general') {
    breadcrumb.textContent = 'Settings';
    mainTitle.textContent = 'General Settings';
    subText.textContent = 'Manage your account, notifications, and preferences';
    document.getElementById('view-settings-general').classList.add('active-view');
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
    reportDrawer.style.right = '-880px';
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
  const dateFiltered = filterCandidatesByDateRange(AppState.candidates);
  AppState.jobs.forEach(job => {
    const jobCandidates = dateFiltered.filter(c => c.jobApplied === job.roleName || c.jobApplied === job.cardName);

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
      closeAllDrawers();
    });
    actionsBody.querySelector('.btn-stage-advance')?.addEventListener('click', () => {
      const next = getCandidateNextStage(candidate.status);
      if (!next) return;
      updateCandidateStatus(candidateId, next);
      closeAllDrawers();
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

  // Breadcrumb — "Jobs" clickable link and Job Name clickable link
  const breadcrumb = document.getElementById('breadcrumb-title');
  const shortName = job.cardName.length > 30 ? job.cardName.slice(0, 30) + '…' : job.cardName;
  breadcrumb.innerHTML = `<span class="breadcrumb-link" id="bc-jobs-link">Jobs</span>
    <span class="breadcrumb-separator">/</span> <span class="breadcrumb-link" id="bc-jobname-link">${shortName}</span>
    <span class="breadcrumb-separator">/</span> Responses`;
  document.getElementById('bc-jobs-link').addEventListener('click', () => navigateToTab('jobs'));
  document.getElementById('bc-jobname-link').addEventListener('click', () => {
    document.querySelectorAll('.jd-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.jd-tab[data-jd-tab="overview"]').classList.add('active');
    document.querySelectorAll('.jd-pane').forEach(p => p.classList.remove('active'));
    document.getElementById('jd-pane-overview').classList.add('active');
    soundEngine.playClick();
  });

  // Header
  toggleHeaderElementsForJobFlow(false);
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

  // Dynamic tabs hiding based on pipeline config
  const cfg = job.pipelineConfig || {
    resumeAnalysis: { enabled: true },
    recruiterScreening: { enabled: true },
    functionalInterview: { enabled: true }
  };

  const tabResume = document.querySelector('.jd-tab[data-jd-tab="resume"]');
  const tabScreening = document.querySelector('.jd-tab[data-jd-tab="screening"]');
  const tabFunctional = document.querySelector('.jd-tab[data-jd-tab="functional"]');

  if (tabResume) tabResume.style.display = cfg.resumeAnalysis?.enabled !== false ? '' : 'none';
  if (tabScreening) tabScreening.style.display = cfg.recruiterScreening?.enabled !== false ? '' : 'none';
  if (tabFunctional) tabFunctional.style.display = cfg.functionalInterview?.enabled !== false ? '' : 'none';

  // Reset to Overview tab
  document.querySelectorAll('.jd-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.jd-tab[data-jd-tab="overview"]').classList.add('active');
  document.querySelectorAll('.jd-pane').forEach(p => p.classList.remove('active'));
  document.getElementById('jd-pane-overview').classList.add('active');

  const jobCandidates = filterCandidatesByDateRange(AppState.candidates).filter(
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
window.navigateToJobDetail = navigateToJobDetail;
window.openReportDrawerForCandidate = openReportDrawerForCandidate;

// ==========================================
// JOB FLOW PIPELINE VIEW
// ==========================================

// Dynamic header manager for Job Flow and Sourcing
function toggleHeaderElementsForJobFlow(showJobFlowHeader, job = null) {
  const searchBox = document.querySelector('.header-right .search-box');
  const themeToggle = document.getElementById('btn-theme-toggle');
  const interviewSettings = document.getElementById('btn-interview-settings');
  const actionBtn = document.getElementById('header-action-btn');
  let headerRight = document.querySelector('.header-right');

  if (showJobFlowHeader && job) {
    if (searchBox) searchBox.style.display = 'none';
    if (themeToggle) themeToggle.style.display = 'none';
    if (interviewSettings) interviewSettings.style.display = 'none';
    if (actionBtn) actionBtn.style.display = 'none';

    // Ensure buttons exist in header-right
    let collabBtn = document.getElementById('jf-header-collab-btn');
    if (!collabBtn && headerRight) {
      collabBtn = document.createElement('button');
      collabBtn.id = 'jf-header-collab-btn';
      collabBtn.className = 'btn-jd-ghost btn-header-collab';
      collabBtn.style.marginRight = '8px';
      collabBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
        Add Collaborator
      `;
      headerRight.insertBefore(collabBtn, headerRight.firstChild);
    }
    let publishBtn = document.getElementById('jf-header-publish-btn');
    if (!publishBtn && headerRight) {
      publishBtn = document.createElement('button');
      publishBtn.id = 'jf-header-publish-btn';
      publishBtn.className = 'btn-jd-primary btn-header-publish';
      publishBtn.innerHTML = `
        Publish Job
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px;"><polyline points="9 18 15 12 9 6"></polyline></svg>
      `;
      headerRight.insertBefore(publishBtn, headerRight.children[1] || headerRight.firstChild);
    }

    if (collabBtn) {
      collabBtn.style.display = '';
      collabBtn.onclick = () => openDrawer('member');
    }
    if (publishBtn) {
      publishBtn.style.display = job.status === 'published' ? 'none' : '';
      publishBtn.onclick = () => openPublishJobModal(job.id);
    }
  } else {
    if (searchBox) searchBox.style.display = '';
    if (themeToggle) themeToggle.style.display = '';
    if (interviewSettings) interviewSettings.style.display = '';
    
    const collabBtn = document.getElementById('jf-header-collab-btn');
    const publishBtn = document.getElementById('jf-header-publish-btn');
    if (collabBtn) collabBtn.style.display = 'none';
    if (publishBtn) publishBtn.style.display = 'none';
  }
}

function openPublishJobModal(jobId) {
  const job = AppState.jobs.find(j => j.id === jobId);
  if (!job) return;

  const existing = document.getElementById('publish-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'publish-modal-overlay';
  overlay.className = 'publish-modal-overlay';

  if (!job.referenceId || job.referenceId === '-') {
    job.referenceId = 'AKR' + job.id.slice(0, 8).toUpperCase() + Math.floor(Math.random() * 900 + 100);
  }

  overlay.innerHTML = `
    <div class="publish-modal">
      <div class="publish-modal-header">
        <div class="publish-header-left">
          <div class="publish-modal-icon-container">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </div>
          <div class="publish-modal-titles">
            <h3>Publish Job</h3>
            <p>Review details before publishing the job</p>
          </div>
        </div>
        <button class="publish-modal-close" id="btn-close-publish-modal">&times;</button>
      </div>

      <div class="publish-warning-banner">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        <span>After publishing, editing will be disabled. Please review carefully.</span>
      </div>

      <div class="publish-modal-body">
        <div class="publish-form-group">
          <label>Job Name (Visible on Job Card)</label>
          <input type="text" id="pub-card-name" class="jf-edit-input" value="${(job.cardName || job.roleName).replace(/"/g, '&quot;')}" />
        </div>
        <div class="publish-form-group">
          <label>Role Name</label>
          <input type="text" id="pub-role-name" class="jf-edit-input" value="${(job.roleName || '').replace(/"/g, '&quot;')}" />
          <span class="pub-form-help">Visible to candidates on the job listing and the interview</span>
        </div>
        <div class="publish-form-group">
          <label>Job Reference ID</label>
          <div class="pub-ref-input-container">
            <input type="text" id="pub-ref-id" class="jf-edit-input" value="${job.referenceId}" readonly style="flex:1; margin-right:8px;" />
            <button class="btn-jd-ghost" id="btn-copy-pub-ref" style="padding: 6px 12px; font-size:0.75rem;">Copy</button>
          </div>
          <span class="pub-form-help">Unique System-generated ID for internal reference</span>
        </div>
        <div class="publish-form-group">
          <label>Tags (optional)</label>
          <input type="text" id="pub-tags" class="jf-edit-input" placeholder="e.g. Remote, Urgent" value="${(job.tags || []).join(', ')}" />
        </div>
      </div>

      <div class="publish-modal-actions">
        <button class="btn-jd-ghost" id="btn-cancel-publish" style="padding: 8px 16px;">Cancel</button>
        <button class="btn-jd-primary" id="btn-confirm-publish" style="padding: 8px 16px; margin-left: 8px;">Confirm & Publish</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('btn-close-publish-modal').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-publish').addEventListener('click', closeModal);

  document.getElementById('btn-copy-pub-ref').addEventListener('click', () => {
    const refInput = document.getElementById('pub-ref-id');
    refInput.select();
    navigator.clipboard.writeText(refInput.value);
    showPremiumToast('Job Reference ID copied to clipboard!', 'success');
  });

  document.getElementById('btn-confirm-publish').addEventListener('click', () => {
    const cardName = document.getElementById('pub-card-name').value.trim();
    const roleName = document.getElementById('pub-role-name').value.trim();
    const tagsVal = document.getElementById('pub-tags').value.trim();

    if (cardName) job.cardName = cardName;
    if (roleName) job.roleName = roleName;
    job.tags = tagsVal ? tagsVal.split(',').map(t => t.trim()).filter(Boolean) : [];
    job.status = 'published';

    if (job.pipelineConfig) {
      job.pipelineConfig.careerPage.enabled = true;
      job.pipelineConfig.resumeAnalysis.enabled = true;
      job.pipelineConfig.recruiterScreening.enabled = true;
      job.pipelineConfig.functionalInterview.enabled = true;
    }

    saveStateToLocalStorage();
    closeModal();
    soundEngine.playChime([392, 523.25, 659.25, 783.99], 0.2, 0.08);
    showPremiumToast(`Job "${job.roleName}" published successfully!`, 'success');

    navigateToSourcing(jobId);
  });
}

function migrateCandidatesOfJob(job) {
  const cfg = job.pipelineConfig;
  if (!cfg) return;

  const jobCandidates = AppState.candidates.filter(c => c.jobApplied === job.roleName || c.jobApplied === job.cardName);

  jobCandidates.forEach(candidate => {
    let currentStatus = candidate.status;
    if (currentStatus === 'Resume' && !cfg.resumeAnalysis.enabled) {
      if (cfg.recruiterScreening.enabled) {
        candidate.status = 'Screening';
      } else if (cfg.functionalInterview.enabled) {
        candidate.status = 'Functional';
      }
    }
    if (candidate.status === 'Screening' && !cfg.recruiterScreening.enabled) {
      if (cfg.functionalInterview.enabled) {
        candidate.status = 'Functional';
      } else if (cfg.resumeAnalysis.enabled) {
        candidate.status = 'Resume';
      }
    }
    if (candidate.status === 'Functional' && !cfg.functionalInterview.enabled) {
      if (cfg.recruiterScreening.enabled) {
        candidate.status = 'Screening';
      } else if (cfg.resumeAnalysis.enabled) {
        candidate.status = 'Resume';
      }
    }
  });
}

function openJobFlowView(jobId, showAddCandidates = false) {
  const job = AppState.jobs.find(j => j.id === jobId);
  if (!job) return;

  // Initialize pipeline config if not present
  if (!job.pipelineConfig) {
    job.pipelineConfig = {
      careerPage: { enabled: true, listed: true },
      resumeAnalysis: { enabled: !!job.resumeCriteria },
      recruiterScreening: { enabled: false },
      functionalInterview: { enabled: job.questions && job.questions.length > 0 }
    };
  }

  AppState.activeTab = 'job-flow';
  AppState.activeJobId = jobId;

  // Sidebar: keep Jobs highlighted as parent
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-tab') === 'jobs');
  });
  document.querySelectorAll('.sub-nav li').forEach(li => li.classList.remove('active-sub'));

  // Show the job flow view
  document.querySelectorAll('.dashboard-view').forEach(v => v.classList.remove('active-view'));
  const flowView = document.getElementById('view-job-flow');
  if (flowView) flowView.classList.add('active-view');

  // Update breadcrumbs
  const shortName = (job.cardName || job.roleName).length > 30 ? (job.cardName || job.roleName).slice(0, 30) + '…' : (job.cardName || job.roleName);
  const breadcrumb = document.getElementById('breadcrumb-title');
  const statusLabel = job.status === 'published' ? 'Published' : 'Draft';
  const badgeClass = job.status === 'published' ? 'published' : 'draft';
  breadcrumb.innerHTML = `<span class="breadcrumb-link" id="bc-jf-jobs">Jobs</span>
    <span class="breadcrumb-separator">/</span> <span class="breadcrumb-link" id="bc-jf-jobname">${shortName}</span>
    <span class="jf-status-badge-top ${badgeClass}">${statusLabel}</span>`;
  document.getElementById('bc-jf-jobs').addEventListener('click', () => navigateToTab('jobs'));
  document.getElementById('bc-jf-jobname').addEventListener('click', () => navigateToJobDetail(jobId));

  // Dynamic header buttons
  toggleHeaderElementsForJobFlow(true, job);

  // Header texts
  document.getElementById('header-main-title').textContent = job.cardName || job.roleName;
  document.getElementById('header-sub-text').textContent = 'Pipeline Configuration';

  renderJobFlowPipeline(job);
  renderJobFlowConfig(job, 'careerPage');

  // Add Candidates banner after fresh AI-generated job creation
  const existingBanner = document.getElementById('jf-add-candidates-banner');
  if (existingBanner) existingBanner.remove();

  if (showAddCandidates) {
    const banner = document.createElement('div');
    banner.id = 'jf-add-candidates-banner';
    banner.className = 'jf-candidates-banner card-glass';
    banner.innerHTML = `
      <div class="jf-banner-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>
      </div>
      <div class="jf-banner-content">
        <div class="jf-banner-title">Job created. Finish the flow from here.</div>
        <p class="jf-banner-desc">Review the pipeline, publish the posting, then add candidates when the setup looks right.</p>
      </div>
      <div class="jf-banner-actions">
        <button class="btn-jf-skip" id="jf-btn-review-flow">Review Flow</button>
        ${job.status === 'published' ? '' : `<button class="btn-jf-skip" id="jf-btn-publish-job">Publish Job</button>`}
        <button class="btn-jf-primary" id="jf-btn-add-candidates">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>
          Add Candidates
        </button>
      </div>
    `;
    flowView.insertBefore(banner, flowView.firstChild);

    document.getElementById('jf-btn-review-flow')?.addEventListener('click', () => {
      banner.classList.add('jf-banner-dismissing');
      setTimeout(() => banner.remove(), 300);
    });
    document.getElementById('jf-btn-publish-job')?.addEventListener('click', () => {
      openPublishJobModal(jobId);
    });
    document.getElementById('jf-btn-add-candidates').addEventListener('click', () => {
      banner.remove();
      navigateToSourcing(jobId);
    });
  }

  soundEngine.playChime([392.00, 523.25, 659.25], 0.15, 0.08);
}
window.openJobFlowView = openJobFlowView;

function renderJobFlowPipeline(job) {
  const panel = document.getElementById('jf-pipeline-panel');
  if (!panel) return;

  const cfg = job.pipelineConfig;
  const criteria = job.resumeCriteria || { mustHave: [], redFlags: [], goodToHave: [] };
  const questionCount = job.questions ? job.questions.length : 0;
  const totalDuration = questionCount * 3;

  const stages = [
    {
      key: 'careerPage',
      name: 'Career Page',
      enabled: cfg.careerPage.enabled,
      detail: cfg.careerPage.listed ? '<span class="jf-stage-badge active">Job Listed</span>' : '',
      subtext: job.cardName || 'Position Not Specified',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
    },
    {
      key: 'resumeAnalysis',
      name: 'Resume Analysis',
      enabled: cfg.resumeAnalysis.enabled,
      detail: '',
      subtext: criteria.mustHave.length ? `${criteria.mustHave.length} Must have · ${criteria.redFlags.length} Red flags · ${criteria.goodToHave.length} Good to have` : 'No parameters added',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
    },
    {
      key: 'recruiterScreening',
      name: 'Recruiter Screening',
      enabled: cfg.recruiterScreening.enabled,
      detail: '',
      subtext: job.screeningParams ? `${job.screeningParams.reduce((a, c) => a + c.params.length, 0)} Parameters` : 'No parameters added',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>'
    },
    {
      key: 'functionalInterview',
      name: 'Functional Interview',
      enabled: cfg.functionalInterview.enabled,
      detail: '',
      subtext: questionCount > 0 ? `${questionCount} Questions · ${totalDuration} Minutes` : 'No questions added',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    }
  ];

  panel.innerHTML = stages.map((s, i) => `
    <div class="jf-stage-card ${s.enabled ? 'enabled' : 'disabled'} ${i === 0 ? 'active' : ''}" data-stage="${s.key}">
      <div class="jf-stage-card-top">
        <div class="jf-stage-info">
          <span class="jf-stage-icon">${s.icon}</span>
          <span class="jf-stage-name">${s.name}</span>
          ${s.detail}
        </div>
        <label class="jf-toggle">
          <input type="checkbox" ${s.enabled ? 'checked' : ''} data-stage="${s.key}" />
          <span class="jf-toggle-track"></span>
        </label>
      </div>
      <p class="jf-stage-subtext">${s.subtext}</p>
    </div>
    ${i < stages.length - 1 ? '<div class="jf-stage-connector"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-faint)" stroke-width="1.5"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg></div>' : ''}
  `).join('');

  // Wire up click handlers
  panel.querySelectorAll('.jf-stage-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.jf-toggle')) return;
      panel.querySelectorAll('.jf-stage-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      renderJobFlowConfig(job, card.dataset.stage);
    });
  });

  // Wire up toggle switches
  panel.querySelectorAll('.jf-toggle input').forEach(toggle => {
    toggle.addEventListener('change', () => {
      const stageKey = toggle.dataset.stage;
      job.pipelineConfig[stageKey].enabled = toggle.checked;
      const card = toggle.closest('.jf-stage-card');
      card.classList.toggle('enabled', toggle.checked);
      card.classList.toggle('disabled', !toggle.checked);
      
      // Candidate stage migration on toggle change
      if (!toggle.checked) {
        migrateCandidatesOfJob(job);
      }
      
      recalculateJobPipelines();
      saveStateToLocalStorage();
      renderJobCards();
    });
  });
}

function renderJobFlowConfig(job, stageKey) {
  const panel = document.getElementById('jf-config-panel');
  if (!panel) return;

  switch (stageKey) {
    case 'careerPage':
      renderCareerPageConfig(job, panel);
      break;
    case 'resumeAnalysis':
      renderResumeAnalysisFlowConfig(job, panel);
      break;
    case 'recruiterScreening':
      renderScreeningConfig(job, panel);
      break;
    case 'functionalInterview':
      renderFunctionalConfig(job, panel);
      break;
  }
}

function escapeHTML(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getVerboseJobDescription(job) {
  const role = job.roleName || 'This role';
  const company = job.companyName || 'Akross';
  const normalizedRole = role.toLowerCase();
  const consultingName = company.toLowerCase().includes('consulting') ? company : `${company} Consulting`;

  if (normalizedRole.includes('government tender')) {
    return {
      overview: `${consultingName} is seeking a detail-oriented and proactive ${role} to support businesses in navigating and winning government tenders. The role involves identifying relevant tender opportunities, analyzing tender documents, preparing bid submissions, and ensuring compliance with government procurement processes. This position requires strong document handling skills and the ability to coordinate with internal teams to meet deadlines. The company specializes in assisting clients across various sectors with government procurement and tendering.`,
      responsibilities: [
        'Identify and track relevant government tenders from portals such as GeM, CPPP, and state procurement platforms.',
        'Analyze tender documents to understand eligibility criteria, scope of work, submission requirements, and compliance checkpoints.',
        'Assist in preparing technical, commercial, and financial bid documents with clear supporting evidence.',
        'Coordinate with internal teams, partners, and subject matter experts to collect necessary documentation and information.',
        'Ensure all tender submissions are compliant with guidelines and submitted before deadlines.',
        'Maintain records of submitted tenders, documentation, clarifications, corrigenda, and follow-ups.',
        'Conduct basic research on government departments, upcoming projects, procurement trends, and competitor activity.'
      ],
      requirements: [
        'Strong attention to detail and ability to work with structured documents.',
        'Good written and verbal communication skills.',
        'Ability to understand and interpret tender documents, eligibility criteria, and submission formats.',
        'Proficiency in MS Excel, Word, Google Workspace, and document collaboration tools.',
        'Ability to manage multiple deadlines and work independently with minimal supervision.'
      ],
      about: `${consultingName} works closely with businesses to help them navigate and win government tenders across various sectors. The company focuses on identifying relevant opportunities, preparing strong proposals, and ensuring complete compliance with government procurement processes.`
    };
  }

  if (normalizedRole.includes('full stack')) {
    return {
      overview: `${company} is hiring a ${role} to design, build, and maintain high-performance web applications across the frontend, backend, and database layers. The role involves translating product requirements into responsive interfaces, building reliable APIs, optimizing latency, and ensuring that data flows consistently across the system. This position is suited for someone who can move between React interfaces, Node.js services, and PostgreSQL-backed workflows while keeping maintainability and user experience in focus.`,
      responsibilities: [
        'Build responsive dashboards and application screens using React, modern JavaScript, and reusable UI patterns.',
        'Develop backend services, API routes, and integration logic using Node.js and Express.',
        'Design and maintain PostgreSQL schemas, queries, and data access patterns for reliable product workflows.',
        'Optimize page performance, API latency, and data loading behavior across key user journeys.',
        'Collaborate with product and design stakeholders to clarify requirements and ship polished features.',
        'Debug production issues across the stack and add safeguards that prevent recurring defects.'
      ],
      requirements: [
        'Hands-on experience with React, JavaScript, HTML, CSS, and component-based frontend development.',
        'Working knowledge of Node.js, Express, REST APIs, and backend validation patterns.',
        'Practical experience with PostgreSQL or another relational database.',
        'Ability to reason about performance, state management, and data consistency.',
        'Clear communication skills and comfort working across product, design, and engineering contexts.'
      ],
      about: `${company} builds modern hiring and workflow software for teams that need fast, reliable, and well-designed internal tools. The engineering culture values clear ownership, thoughtful implementation, and interfaces that help users complete complex tasks with less friction.`
    };
  }

  const description = job.description && job.description !== 'No job description provided.'
    ? job.description
    : `${job.companyName || company} is hiring for ${role}. This role is responsible for owning day-to-day execution, coordinating with stakeholders, and delivering high-quality work against clear business goals.`;

  return {
    overview: description,
    responsibilities: [
      `Own core execution for the ${role} role from planning through delivery.`,
      'Coordinate with internal stakeholders to gather context, clarify requirements, and resolve blockers.',
      'Maintain clear documentation, status updates, and handoff notes for ongoing work.',
      'Track deadlines, quality checkpoints, and follow-up actions across the workflow.',
      'Identify process gaps and suggest practical improvements that reduce manual effort.'
    ],
    requirements: [
      'Strong written and verbal communication skills.',
      'Ability to manage multiple priorities with attention to detail.',
      'Comfort working with documents, tools, and structured operational processes.',
      'Ownership mindset with the ability to work independently and ask clear questions when needed.'
    ],
    about: `${job.companyName || company} works with teams that need reliable execution, clear communication, and practical problem solving across business-critical workflows.`
  };
}

function renderVerboseJobDescription(job) {
  const content = getVerboseJobDescription(job);
  const company = escapeHTML(job.companyName || 'Akross');
  const location = escapeHTML(job.location || 'Delhi, India');
  const role = escapeHTML(job.cardName || job.roleName || 'Untitled Role');
  const roleName = escapeHTML(job.roleName || 'Untitled Role');
  const experience = escapeHTML(job.experienceBand || 'Fresher');
  const jobType = escapeHTML(job.jobType || 'Full-Time');

  return `
    <div class="jf-jd-hero">
      <h4 class="jf-jd-title">${role}</h4>
      <div class="jf-jd-meta">
        <span><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> ${company}</span>
        <span>${location}</span>
      </div>
      <div class="jf-jd-chip-row">
        <span class="jf-jd-badge">${jobType}</span>
        <span class="jf-jd-badge">${experience}</span>
      </div>
    </div>

    <div class="jf-jd-rich-body">
      <section class="jf-jd-rich-section">
        <h5>Job overview</h5>
        <p>${escapeHTML(content.overview)}</p>
      </section>
      <section class="jf-jd-rich-section">
        <h5>Key responsibilities</h5>
        <ul>${content.responsibilities.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul>
      </section>
      <section class="jf-jd-rich-section">
        <h5>Requirements</h5>
        <ul>${content.requirements.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul>
      </section>
      <section class="jf-jd-rich-section">
        <h5>About ${company}</h5>
        <p>${escapeHTML(content.about)}</p>
      </section>
      <section class="jf-jd-rich-section compact">
        <h5>Role configured as</h5>
        <p>${roleName}</p>
      </section>
    </div>
  `;
}

function renderCareerPageConfig(job, panel) {
  const fields = job.applicationFields || ['Current Location', 'Expected CTC', 'Notice Period'];
  const isEditing = panel.dataset.cpEditing === 'true';

  panel.innerHTML = `
    <div class="jf-config-header">
      <div class="jf-config-header-left">
        <h2 class="jf-config-title">Career Page</h2>
        <p class="jf-config-subtitle">Publish your job and let AI screen every application instantly</p>
      </div>
      <div class="jf-config-header-actions">
        <button class="btn-jf-edit" id="btn-cp-edit">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          ${isEditing ? 'Save' : 'Edit'}
        </button>
      </div>
    </div>

    <div class="jf-section">
      <div class="jf-section-header">
        <h3 class="jf-section-title" style="color: var(--color-gold);">Job Description</h3>
      </div>
      <div class="jf-jd-card">
        ${isEditing ? `
          <div class="jf-edit-field">
            <label class="jf-edit-label">Job Title</label>
            <input type="text" class="jf-edit-input" id="cp-edit-title" value="${(job.cardName || job.roleName || '').replace(/"/g, '&quot;')}" />
          </div>
          <div class="jf-edit-field">
            <label class="jf-edit-label">Role Name</label>
            <input type="text" class="jf-edit-input" id="cp-edit-role" value="${(job.roleName || '').replace(/"/g, '&quot;')}" />
          </div>
          <div class="jf-edit-field">
            <label class="jf-edit-label">Experience Band</label>
            <select class="jf-edit-input" id="cp-edit-exp">
              ${['Fresher', 'Upto 2 Years', '1-4 Years', '3-6 Years', '5-10 Years', '8-15 Years', '10+ Years'].map(o =>
                `<option ${(job.experienceBand || '') === o ? 'selected' : ''}>${o}</option>`
              ).join('')}
            </select>
          </div>
          <div class="jf-edit-field">
            <label class="jf-edit-label">Job Description</label>
            <textarea class="jf-edit-textarea" id="cp-edit-desc" rows="6">${job.description || ''}</textarea>
          </div>
        ` : renderVerboseJobDescription(job)}
      </div>
    </div>

    <div class="jf-section">
      <div class="jf-section-header">
        <div>
          <h3 class="jf-section-title" style="display: flex; align-items: center; gap: 8px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Application Form Fields
          </h3>
          <p style="font-size: 0.76rem; color: var(--color-text-muted); margin: 2px 0 0 0;">Fields candidates will fill out during application</p>
        </div>
      </div>
      <div class="jf-fields-header">Enabled Fields (${fields.length})</div>
      <div class="jf-fields-list">
        ${fields.map((f, i) => `
          <div class="jf-field-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            ${isEditing
              ? `<input type="text" class="jf-edit-input jf-field-edit" value="${f.replace(/"/g, '&quot;')}" data-idx="${i}" style="flex:1;" />
                 <button class="btn-jf-remove-field" data-idx="${i}" title="Remove">×</button>`
              : `<span>${f}</span>`}
          </div>
        `).join('')}
        ${isEditing ? `<button class="btn-jf-add-field" id="btn-cp-add-field" style="margin-top:6px;">+ Add Field</button>` : ''}
      </div>
    </div>
  `;

  const editBtn = document.getElementById('btn-cp-edit');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      if (isEditing) {
        const newTitle = document.getElementById('cp-edit-title')?.value.trim();
        const newRole = document.getElementById('cp-edit-role')?.value.trim();
        const newExp = document.getElementById('cp-edit-exp')?.value;
        const newDesc = document.getElementById('cp-edit-desc')?.value.trim();
        if (newTitle) job.cardName = newTitle;
        if (newRole) job.roleName = newRole;
        if (newExp) job.experienceBand = newExp;
        job.description = newDesc || '';
        const editedFields = [];
        panel.querySelectorAll('.jf-field-edit').forEach(input => {
          if (input.value.trim()) editedFields.push(input.value.trim());
        });
        if (editedFields.length) job.applicationFields = editedFields;
        saveStateToLocalStorage();
        showPremiumToast('Job details saved.', 'success');
        panel.dataset.cpEditing = 'false';
        renderCareerPageConfig(job, panel);
        renderJobFlowPipeline(job);
      } else {
        panel.dataset.cpEditing = 'true';
        renderCareerPageConfig(job, panel);
      }
    });
  }

  if (isEditing) {
    panel.querySelectorAll('.btn-jf-remove-field').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const inputs = panel.querySelectorAll('.jf-field-edit');
        inputs[idx]?.closest('.jf-field-item')?.remove();
      });
    });
    document.getElementById('btn-cp-add-field')?.addEventListener('click', () => {
      const list = panel.querySelector('.jf-fields-list');
      const idx = list.querySelectorAll('.jf-field-item').length;
      const item = document.createElement('div');
      item.className = 'jf-field-item';
      item.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <input type="text" class="jf-edit-input jf-field-edit" value="" data-idx="${idx}" style="flex:1;" placeholder="New field name..." />
        <button class="btn-jf-remove-field" data-idx="${idx}" title="Remove">×</button>
      `;
      list.insertBefore(item, document.getElementById('btn-cp-add-field'));
      item.querySelector('.btn-jf-remove-field').addEventListener('click', () => item.remove());
      item.querySelector('input').focus();
    });
  }
}

function renderResumeAnalysisConfig(job, panel) {
  const criteria = job.resumeCriteria || { mustHave: [], redFlags: [], goodToHave: [], goodToHaveMinMatch: 1 };

  panel.innerHTML = `
    <div class="jf-config-header">
      <div class="jf-config-header-left">
        <h2 class="jf-config-title">Resume Analysis</h2>
        <p class="jf-config-subtitle">Parameters created based on your requirements — feel free to edit them</p>
      </div>
      <div class="jf-config-header-actions">
        <button class="btn-jf-edit" id="jf-btn-edit-resume">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </button>
      </div>
    </div>

    <div class="ra-criteria-group must-have">
      <div class="ra-criteria-group-header">
        <span class="ra-criteria-icon must-have"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>
        <div>
          <h4 class="ra-criteria-group-title must-have">Must Have</h4>
          <p class="ra-criteria-group-desc">Candidates meeting these criteria will be shortlisted; others waitlisted for review</p>
        </div>
      </div>
      <div class="ra-criteria-items">${criteria.mustHave.map((item, i) => `<div class="ra-criteria-item must-have"><span class="ra-criteria-num must-have">${i+1}</span><span class="ra-criteria-text">${item}</span></div>`).join('')}</div>
    </div>

    <div class="ra-criteria-divider"><span class="ra-criteria-divider-text">AND</span></div>

    <div class="ra-criteria-group red-flags">
      <div class="ra-criteria-group-header">
        <span class="ra-criteria-icon red-flags"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
        <div>
          <h4 class="ra-criteria-group-title red-flags">Should Not Have (Red Flags)</h4>
          <p class="ra-criteria-group-desc">Candidates with no red flags will be shortlisted; others waitlisted for review</p>
        </div>
      </div>
      <div class="ra-criteria-items">${criteria.redFlags.map((item, i) => `<div class="ra-criteria-item red-flags"><span class="ra-criteria-num red-flags">${i+1}</span><span class="ra-criteria-text">${item}</span></div>`).join('')}</div>
    </div>

    <div class="ra-criteria-divider"><span class="ra-criteria-divider-text">AND</span></div>

    <div class="ra-criteria-group good-to-have">
      <div class="ra-criteria-group-header">
        <span class="ra-criteria-icon good-to-have"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></span>
        <div>
          <h4 class="ra-criteria-group-title good-to-have">Good To Have</h4>
          <p class="ra-criteria-group-desc">Candidates meeting the threshold will be shortlisted; others waitlisted for review.</p>
        </div>
      </div>
      <div class="ra-criteria-min-match">Minimum match: ${criteria.goodToHaveMinMatch} out of ${criteria.goodToHave.length} criteria</div>
      <div class="ra-criteria-items">${criteria.goodToHave.map((item, i) => `<div class="ra-criteria-item good-to-have"><span class="ra-criteria-num good-to-have">${i+1}</span><span class="ra-criteria-text">${item}</span></div>`).join('')}</div>
    </div>
  `;
}

function renderResumeAnalysisFlowConfig(job, panel) {
  const criteria = job.resumeCriteria || { mustHave: [], redFlags: [], goodToHave: [], goodToHaveMinMatch: 1 };
  const isEditing = panel.dataset.raEditing === 'true';
  const renderRows = (items, groupKey, tone) => {
    const rows = (isEditing && items.length === 0) ? [''] : items;
    const html = rows.map((item, i) => isEditing ? `
      <div class="ra-criteria-item-edit">
        <span class="ra-criteria-num ${tone}">${i + 1}</span>
        <input type="text" class="ra-criteria-edit-input" value="${(item || '').replace(/"/g, '&quot;')}" placeholder="Enter criterion..." />
        <button class="btn-ra-remove-criteria" type="button" title="Remove criterion">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    ` : `
      <div class="ra-criteria-item ${tone}">
        <span class="ra-criteria-num ${tone}">${i + 1}</span>
        <span class="ra-criteria-text">${item}</span>
      </div>
    `).join('');
    return html + (isEditing ? `<button class="btn-ra-add-criteria" type="button" data-group="${groupKey}" data-tone="${tone}">+ Add Criterion</button>` : '');
  };

  panel.innerHTML = `
    <div class="jf-config-header">
      <div class="jf-config-header-left">
        <h2 class="jf-config-title">Resume Analysis</h2>
        <p class="jf-config-subtitle">Own shortlist rules here, then run candidate analysis from the Resume Analysis tab</p>
      </div>
      <div class="jf-config-header-actions">
        <button class="btn-jf-edit" id="jf-btn-edit-resume">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${isEditing ? '<polyline points="20 6 9 17 4 12"/>' : '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'}</svg>
          ${isEditing ? 'Save Rules' : 'Edit Rules'}
        </button>
      </div>
    </div>

    <div class="ra-criteria-group must-have">
      <div class="ra-criteria-group-header">
        <span class="ra-criteria-icon must-have"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>
        <div>
          <h4 class="ra-criteria-group-title must-have">Must Have</h4>
          <p class="ra-criteria-group-desc">Candidates meeting these rules can move forward automatically</p>
        </div>
      </div>
      <div class="ra-criteria-items">${renderRows(criteria.mustHave, 'mustHave', 'must-have')}</div>
    </div>

    <div class="ra-criteria-divider"><span class="ra-criteria-divider-text">AND</span></div>

    <div class="ra-criteria-group red-flags">
      <div class="ra-criteria-group-header">
        <span class="ra-criteria-icon red-flags"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
        <div>
          <h4 class="ra-criteria-group-title red-flags">Red Flags</h4>
          <p class="ra-criteria-group-desc">Detected items hold or reject a candidate for manual review</p>
        </div>
      </div>
      <div class="ra-criteria-items">${renderRows(criteria.redFlags, 'redFlags', 'red-flags')}</div>
    </div>

    <div class="ra-criteria-divider"><span class="ra-criteria-divider-text">AND</span></div>

    <div class="ra-criteria-group good-to-have">
      <div class="ra-criteria-group-header">
        <span class="ra-criteria-icon good-to-have"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></span>
        <div>
          <h4 class="ra-criteria-group-title good-to-have">Good To Have</h4>
          <p class="ra-criteria-group-desc">Bonus signals that improve the fit score</p>
        </div>
      </div>
      <div class="ra-criteria-min-match">
        Minimum match:
        ${isEditing ? `<input type="number" class="ra-min-match-input" value="${criteria.goodToHaveMinMatch || 1}" min="1" max="${Math.max(criteria.goodToHave.length, 1)}" />` : criteria.goodToHaveMinMatch}
        out of ${criteria.goodToHave.length} criteria
      </div>
      <div class="ra-criteria-items">${renderRows(criteria.goodToHave, 'goodToHave', 'good-to-have')}</div>
    </div>
  `;

  const renumber = (container) => {
    container.querySelectorAll('.ra-criteria-num').forEach((num, idx) => { num.textContent = idx + 1; });
  };

  panel.querySelectorAll('.btn-ra-add-criteria').forEach(btn => {
    btn.addEventListener('click', () => {
      const container = btn.closest('.ra-criteria-items');
      if (!container) return;
      const tone = btn.dataset.tone || 'must-have';
      const count = container.querySelectorAll('.ra-criteria-item-edit').length + 1;
      const row = document.createElement('div');
      row.className = 'ra-criteria-item-edit';
      row.innerHTML = `
        <span class="ra-criteria-num ${tone}">${count}</span>
        <input type="text" class="ra-criteria-edit-input" value="" placeholder="Enter criterion..." />
        <button class="btn-ra-remove-criteria" type="button" title="Remove criterion">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;
      container.insertBefore(row, btn);
      row.querySelector('.btn-ra-remove-criteria').addEventListener('click', () => {
        row.remove();
        renumber(container);
      });
      row.querySelector('input')?.focus();
    });
  });

  panel.querySelectorAll('.btn-ra-remove-criteria').forEach(btn => {
    btn.addEventListener('click', () => {
      const container = btn.closest('.ra-criteria-items');
      btn.closest('.ra-criteria-item-edit')?.remove();
      if (container) renumber(container);
    });
  });

  document.getElementById('jf-btn-edit-resume')?.addEventListener('click', () => {
    if (!isEditing) {
      panel.dataset.raEditing = 'true';
      renderResumeAnalysisFlowConfig(job, panel);
      return;
    }

    const next = { mustHave: [], redFlags: [], goodToHave: [], goodToHaveMinMatch: 1 };
    panel.querySelectorAll('.ra-criteria-group.must-have .ra-criteria-edit-input').forEach(input => {
      if (input.value.trim()) next.mustHave.push(input.value.trim());
    });
    panel.querySelectorAll('.ra-criteria-group.red-flags .ra-criteria-edit-input').forEach(input => {
      if (input.value.trim()) next.redFlags.push(input.value.trim());
    });
    panel.querySelectorAll('.ra-criteria-group.good-to-have .ra-criteria-edit-input').forEach(input => {
      if (input.value.trim()) next.goodToHave.push(input.value.trim());
    });
    const min = parseInt(panel.querySelector('.ra-min-match-input')?.value, 10);
    next.goodToHaveMinMatch = Math.min(Math.max(Number.isFinite(min) ? min : 1, 1), Math.max(next.goodToHave.length, 1));
    job.resumeCriteria = next;
    panel.dataset.raEditing = 'false';
    saveStateToLocalStorage();
    showPremiumToast('Resume analysis rules saved.', 'success');
    renderResumeAnalysisFlowConfig(job, panel);
    renderJobFlowPipeline(job);
  });
}

function renderScreeningConfig(job, panel) {
  const params = job.screeningParams || [];
  const totalParams = params.reduce((a, c) => a + c.params.length, 0);

  panel.innerHTML = `
    <div class="jf-config-header">
      <div class="jf-config-header-left">
        <h2 class="jf-config-title">Recruiter Screening</h2>
        <p class="jf-config-subtitle">AI-powered screening with configurable parameters</p>
      </div>
      <div class="jf-config-header-actions">
        <span class="jf-stat-pill"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> ${totalParams} Parameters</span>
        <span class="jf-stat-pill"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> 5 – 10 mins</span>
      </div>
    </div>

    <div class="jf-screening-tabs">
      <button class="jf-tab active">Screening Parameters</button>
      <button class="jf-tab">Test Interview</button>
      <button class="jf-tab">Settings</button>
    </div>

    ${params.map(cat => `
      <div class="jf-param-category">
        <h4 class="jf-param-category-title">
          ${cat.category === 'Experience' ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>' :
            cat.category === 'Location' ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' :
            cat.category === 'Compensation' ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>' :
            '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'}
          ${cat.category}
        </h4>
        <div class="jf-param-table-header">
          <span class="jf-ph-drag"></span>
          <span class="jf-ph-req">Req</span>
          <span class="jf-ph-param">Parameter</span>
          <span class="jf-ph-flex">Flexibility</span>
          <span class="jf-ph-resp">Preferred Response</span>
        </div>
        ${cat.params.map(p => `
          <div class="jf-param-row">
            <span class="jf-pr-drag"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg></span>
            <span class="jf-pr-req"><input type="checkbox" ${p.required ? 'checked' : ''} /></span>
            <span class="jf-pr-param">${p.name}</span>
            <span class="jf-pr-flex"><select class="jf-select-sm"><option>Select</option><option>Must Match</option><option>Flexible</option><option>Nice to Have</option></select></span>
            <span class="jf-pr-resp"><input type="text" class="jf-input-sm" value="${p.preferredResponse}" placeholder="Enter preferred response..." /></span>
          </div>
        `).join('')}
      </div>
    `).join('')}

    <button class="btn-jf-primary" id="btn-screening-save" style="margin-top: 20px; width: 100%;">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
      Save Parameters
    </button>
  `;

  panel.querySelectorAll('.jf-param-row').forEach(row => {
    const reqCheckbox = row.querySelector('.jf-pr-req input');
    const flexSelect = row.querySelector('.jf-pr-flex select');
    const respInput = row.querySelector('.jf-pr-resp input');
    const paramName = row.querySelector('.jf-pr-param')?.textContent.trim();

    if (flexSelect) {
      const param = params.flatMap(c => c.params).find(p => p.name === paramName);
      if (param?.flexibility) flexSelect.value = param.flexibility;
    }

    [reqCheckbox, flexSelect, respInput].forEach(el => {
      if (el) el.addEventListener('change', () => { el.closest('.jf-param-row').classList.add('jf-row-dirty'); });
    });
  });

  document.getElementById('btn-screening-save')?.addEventListener('click', () => {
    panel.querySelectorAll('.jf-param-category').forEach(catEl => {
      const catTitle = catEl.querySelector('.jf-param-category-title')?.textContent.trim();
      const cat = params.find(c => c.category === catTitle);
      if (!cat) return;
      catEl.querySelectorAll('.jf-param-row').forEach(row => {
        const name = row.querySelector('.jf-pr-param')?.textContent.trim();
        const param = cat.params.find(p => p.name === name);
        if (!param) return;
        param.required = row.querySelector('.jf-pr-req input')?.checked ?? param.required;
        param.flexibility = row.querySelector('.jf-pr-flex select')?.value || 'Select';
        param.preferredResponse = row.querySelector('.jf-pr-resp input')?.value || '';
      });
    });
    job.screeningParams = params;
    saveStateToLocalStorage();
    showPremiumToast('Screening parameters saved.', 'success');
    panel.querySelectorAll('.jf-row-dirty').forEach(r => r.classList.remove('jf-row-dirty'));
  });
}

function renderFunctionalConfig(job, panel) {
  const questions = job.questions || [];
  const totalDuration = questions.length * 3;

  // Group questions by type
  const groups = {};
  questions.forEach(q => {
    const key = q.type || 'technical';
    if (!groups[key]) groups[key] = [];
    groups[key].push(q);
  });

  panel.innerHTML = `
    <div class="jf-config-header">
      <div class="jf-config-header-left">
        <h2 class="jf-config-title">Functional Interview</h2>
        <p class="jf-config-subtitle">AI conducts domain-specific interviews using adaptive questioning and skill frameworks</p>
      </div>
      <div class="jf-config-header-actions">
        <span class="jf-stat-pill"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> ${questions.length} Questions</span>
        <span class="jf-stat-pill"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${totalDuration} Minutes</span>
      </div>
    </div>

    <div class="jf-screening-tabs">
      <button class="jf-tab active">Interview Structure</button>
      <button class="jf-tab">Test Interview</button>
      <button class="jf-tab">Settings</button>
    </div>

    <div class="jf-interview-structure">
      <div class="jf-structure-item intro">
        <span class="jf-structure-icon"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>
        <span class="jf-structure-name">Introduction</span>
        <span class="jf-structure-expand"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></span>
      </div>

      ${Object.entries(groups).map(([type, qs]) => {
        const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
        const typeColor = type === 'technical' ? '#38bdf8' : type === 'behavioral' ? '#a855f7' : type === 'situational' ? '#34d399' : '#fbbf24';
        const avgDiff = qs[0]?.difficulty || 'intermediate';
        const diffLabel = avgDiff.charAt(0).toUpperCase() + avgDiff.slice(1);
        return `
          <div class="jf-structure-item">
            <span class="jf-structure-icon"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${typeColor}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>
            <span class="jf-structure-name">${typeLabel} Questions</span>
            <div class="jf-structure-badges">
              <span class="jf-badge" style="color:${typeColor};border-color:${typeColor}30;background:${typeColor}10">${typeLabel}</span>
              <span class="jf-badge">${qs.length} Question${qs.length !== 1 ? 's' : ''}</span>
              <span class="jf-badge">${diffLabel}</span>
            </div>
            <span class="jf-structure-expand"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></span>
          </div>
        `;
      }).join('')}

      <div class="jf-structure-item coding">
        <span class="jf-structure-icon"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></span>
        <span class="jf-structure-name">Coding Question Pool</span>
        <div class="jf-structure-badges">
          <span class="jf-badge coding">DSA</span>
          <span class="jf-badge">3 Follow ups</span>
          <span class="jf-badge">Medium</span>
        </div>
      </div>
    </div>

    <div class="jf-section" style="margin-top:16px;">
      <div class="jf-section-header">
        <h3 class="jf-section-title" style="display:flex;align-items:center;gap:8px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit Questions
        </h3>
      </div>
      <div class="jf-questions-edit-list" id="jf-questions-list">
        ${questions.map((q, i) => {
          const typeColor = q.type === 'technical' ? '#38bdf8' : q.type === 'behavioral' ? '#a855f7' : q.type === 'situational' ? '#34d399' : '#fbbf24';
          return `
            <div class="jf-question-edit-row" data-qi="${i}">
              <span class="jf-qe-num">${i + 1}</span>
              <span class="jf-badge" style="color:${typeColor};border-color:${typeColor}30;background:${typeColor}10;font-size:0.65rem;">${(q.type || 'technical').charAt(0).toUpperCase() + (q.type || 'technical').slice(1)}</span>
              <input type="text" class="jf-edit-input jf-qe-text" value="${(q.text || q.question || '').replace(/"/g, '&quot;')}" data-qi="${i}" />
              <select class="jf-edit-input jf-qe-diff" data-qi="${i}" style="width:110px;">
                <option ${q.difficulty === 'easy' ? 'selected' : ''}>easy</option>
                <option ${q.difficulty === 'intermediate' || !q.difficulty ? 'selected' : ''}>intermediate</option>
                <option ${q.difficulty === 'hard' ? 'selected' : ''}>hard</option>
              </select>
              <button class="btn-jf-remove-field jf-qe-delete" data-qi="${i}" title="Delete question">×</button>
            </div>
          `;
        }).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button class="btn-jf-primary" id="btn-fi-add-question" style="flex:1;">+ Add Question</button>
        <button class="btn-jf-primary" id="btn-fi-save-questions" style="flex:1;background:rgba(16,185,129,0.12);border-color:rgba(16,185,129,0.3);color:#34d399;">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          Save Questions
        </button>
      </div>
    </div>
  `;

  panel.querySelectorAll('.jf-qe-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.jf-question-edit-row').remove();
      panel.querySelectorAll('.jf-qe-num').forEach((num, i) => { num.textContent = i + 1; });
    });
  });

  document.getElementById('btn-fi-add-question')?.addEventListener('click', () => {
    const list = document.getElementById('jf-questions-list');
    const idx = list.querySelectorAll('.jf-question-edit-row').length;
    const row = document.createElement('div');
    row.className = 'jf-question-edit-row';
    row.dataset.qi = idx;
    row.innerHTML = `
      <span class="jf-qe-num">${idx + 1}</span>
      <span class="jf-badge" style="color:#38bdf8;border-color:#38bdf830;background:#38bdf810;font-size:0.65rem;">Technical</span>
      <input type="text" class="jf-edit-input jf-qe-text" value="" data-qi="${idx}" placeholder="Enter question..." />
      <select class="jf-edit-input jf-qe-diff" data-qi="${idx}" style="width:110px;">
        <option>easy</option><option selected>intermediate</option><option>hard</option>
      </select>
      <button class="btn-jf-remove-field jf-qe-delete" data-qi="${idx}" title="Delete question">×</button>
    `;
    list.appendChild(row);
    row.querySelector('.jf-qe-delete').addEventListener('click', () => {
      row.remove();
      list.querySelectorAll('.jf-qe-num').forEach((num, i) => { num.textContent = i + 1; });
    });
    row.querySelector('input').focus();
  });

  document.getElementById('btn-fi-save-questions')?.addEventListener('click', () => {
    const newQuestions = [];
    panel.querySelectorAll('.jf-question-edit-row').forEach(row => {
      const text = row.querySelector('.jf-qe-text')?.value.trim();
      if (!text) return;
      const qi = parseInt(row.dataset.qi);
      const existing = questions[qi] || {};
      newQuestions.push({
        ...existing,
        text: text,
        question: text,
        difficulty: row.querySelector('.jf-qe-diff')?.value || 'intermediate',
        type: existing.type || 'technical'
      });
    });
    job.questions = newQuestions;
    saveStateToLocalStorage();
    showPremiumToast(`${newQuestions.length} questions saved.`, 'success');
    renderFunctionalConfig(job, panel);
    renderJobFlowPipeline(job);
  });
}

function renderFunnelStages(job) {
  const container = document.getElementById('jd-funnel-stages');
  if (!container) return;

  const total = Math.max(job.pipeline.total, 1);

  const jobCandidates = AppState.candidates.filter(
    c => c.jobApplied === job.roleName || c.jobApplied === job.cardName
  );

  const completedCount = jobCandidates.filter(c => c.interviewStatus === 'Completed').length;
  const qualifiedCount = jobCandidates.filter(c => c.status === 'Hired').length;

  const sourceColors = {
    'Career Page': '#6366f1',
    'ATS': '#06b6d4',
    'Bulk Upload': '#f59e0b',
    'Scheduled': '#ec4899',
    'Direct Link': '#10b981'
  };

  function getSourceBreakdown(candidates) {
    const breakdown = {};
    candidates.forEach(c => {
      const src = c.source || 'Unknown';
      breakdown[src] = (breakdown[src] || 0) + 1;
    });
    return breakdown;
  }

  const stageFilters = {
    'Total Candidates': () => jobCandidates,
    'Resume Analysis': () => jobCandidates.filter(c => c.status === 'Resume'),
    'Recruiter Screening': () => jobCandidates.filter(c => c.status === 'Screening'),
    'Functional Interview': () => jobCandidates.filter(c => c.status === 'Functional'),
    'Completed': () => jobCandidates.filter(c => c.status === 'Functional' || c.status === 'Hired'),
    'Qualified': () => jobCandidates.filter(c => c.status === 'Hired'),
  };

  const stages = [
    { count: job.pipeline.total, label: 'Total Candidates', conv: null },
    { count: job.pipeline.resume,     label: 'Resume Analysis',      conv: Math.round((job.pipeline.resume / total) * 100) },
    { count: job.pipeline.screening,  label: 'Recruiter Screening',  conv: Math.round((job.pipeline.screening / total) * 100) },
    { count: job.pipeline.functional, label: 'Functional Interview', conv: Math.round((job.pipeline.functional / total) * 100) },
    { count: completedCount,           label: 'Completed',            conv: Math.round((completedCount / total) * 100) },
    { count: qualifiedCount,           label: 'Qualified',            conv: Math.round((qualifiedCount / total) * 100) },
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

  const wrap = svgEl.parentElement;
  const rect = wrap ? wrap.getBoundingClientRect() : { width: 460, height: 400 };
  const W = Math.max(rect.width || 460, 200);
  const H = Math.max(rect.height || 400, 200);
  const cx = W / 2;
  const maxHW = W * 0.32;
  const padT = 10, padB = 10;

  const total = Math.max(job.pipeline.total, 1);
  const completedCount = candidates.filter(c => c.interviewStatus === 'Completed').length;
  const qualifiedCount = candidates.filter(c => c.status === 'Hired').length;

  const cfg = job.pipelineConfig || {};
  const includeResume = cfg.resumeAnalysis?.enabled !== false;
  const includeScreening = cfg.recruiterScreening?.enabled !== false;
  const includeFunctional = cfg.functionalInterview?.enabled !== false;

  const stageLabels = ['Total Candidates'];
  const stageCounts = [job.pipeline.total];
  if (includeResume) { stageLabels.push('Resume Analysis'); stageCounts.push(job.pipeline.resume || 0); }
  if (includeScreening) { stageLabels.push('Recruiter Screening'); stageCounts.push(job.pipeline.screening || 0); }
  if (includeFunctional) { stageLabels.push('Functional Interview'); stageCounts.push(job.pipeline.functional || 0); }
  stageLabels.push('Completed', 'Qualified');
  stageCounts.push(completedCount, qualifiedCount);
  const n = stageCounts.length;
  const ys = stageCounts.map((_, i) => padT + (i / (n - 1)) * (H - padT - padB));

  const hws = stageCounts.map((c, i) => {
    if (i === 0) return maxHW;
    if (c === 0) return 3;
    return Math.max((c / total) * maxHW, 9);
  });

  const pts = stageCounts.map((_, i) => ({
    y: ys[i],
    lx: cx - hws[i],
    rx: cx + hws[i],
  }));

  const isLight = document.body.classList.contains('light-theme');
  const dividerStroke = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.065)';

  const sourceColors = {
    'Career Page': '#6366f1', 'ATS': '#06b6d4', 'Bulk Upload': '#f59e0b',
    'Scheduled': '#ec4899', 'Direct Link': '#10b981'
  };
  const sourceOrder = ['Career Page', 'ATS', 'Bulk Upload', 'Scheduled', 'Direct Link'];
  const stageStatusMap = {
    'Total Candidates': null, 'Resume Analysis': 'Resume', 'Recruiter Screening': 'Screening',
    'Functional Interview': 'Functional', 'Completed': 'Functional', 'Qualified': 'Hired'
  };

  function getBreakdownForStage(stageLabel) {
    const status = stageStatusMap[stageLabel];
    let stageCands;
    if (stageLabel === 'Total Candidates') stageCands = candidates;
    else if (stageLabel === 'Completed') stageCands = candidates.filter(c => c.status === 'Functional' || c.status === 'Hired');
    else stageCands = candidates.filter(c => c.status === status);
    const breakdown = {};
    stageCands.forEach(c => { const src = c.source || 'Unknown'; breakdown[src] = (breakdown[src] || 0) + 1; });
    return breakdown;
  }

  function getSourceFractions(stageIdx) {
    const label = stageLabels[stageIdx];
    const breakdown = getBreakdownForStage(label);
    const stageTotal = Object.values(breakdown).reduce((a, b) => a + b, 0) || 1;
    const fracs = [];
    sourceOrder.forEach(src => {
      if (breakdown[src]) fracs.push({ source: src, frac: breakdown[src] / stageTotal, color: sourceColors[src] });
    });
    Object.keys(breakdown).forEach(src => {
      if (!sourceOrder.includes(src)) fracs.push({ source: src, frac: breakdown[src] / stageTotal, color: '#888' });
    });
    if (fracs.length === 0) fracs.push({ source: 'None', frac: 1, color: 'rgba(255,255,255,0.08)' });
    return fracs;
  }

  svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svgEl.setAttribute('pointer-events', 'all');
  svgEl.style.cursor = 'pointer';

  while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

  const svgNS = 'http://www.w3.org/2000/svg';

  pts.slice(1, -1).forEach(p => {
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', p.lx - 14);
    line.setAttribute('y1', p.y);
    line.setAttribute('x2', p.rx + 14);
    line.setAttribute('y2', p.y);
    line.setAttribute('stroke', dividerStroke);
    line.setAttribute('stroke-width', '1');
    line.setAttribute('stroke-dasharray', '4 3');
    line.setAttribute('pointer-events', 'none');
    svgEl.appendChild(line);
  });

  for (let i = 0; i < n - 1; i++) {
    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('data-stage-idx', String(i));
    g.setAttribute('pointer-events', 'all');
    g.style.cursor = 'pointer';

    const p = pts[i], q = pts[i + 1];
    const dy = q.y - p.y;
    const cp1Y = p.y + dy * 0.28; // organic flow
    const cp2Y = p.y + dy * 0.72; // organic flow
    const topW = p.rx - p.lx;
    const botW = q.rx - q.lx;
    const fracs = getSourceFractions(i);

    let topOffset = 0;
    let botOffset = 0;
    fracs.forEach(({ frac, color }) => {
      const topSlice = topW * frac;
      const botSlice = botW * frac;
      const tl = p.lx + topOffset;
      const tr = tl + topSlice;
      const bl = q.lx + botOffset;
      const br = bl + botSlice;

      const d =
        `M ${tl} ${p.y} L ${tr} ${p.y}` +
        ` C ${tr} ${cp1Y} ${br} ${cp2Y} ${br} ${q.y}` +
        ` L ${bl} ${q.y}` +
        ` C ${bl} ${cp2Y} ${tl} ${cp1Y} ${tl} ${p.y} Z`;

      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', color);
      path.setAttribute('opacity', '0.9');
      path.setAttribute('pointer-events', 'all');
      g.appendChild(path);

      topOffset += topSlice;
      botOffset += botSlice;
    });

    svgEl.appendChild(g);
  }

  /* ── Feathered gradient overlays at stage boundaries ── */
  if (n > 2) {
    const defs = document.createElementNS(svgNS, 'defs');
    for (let i = 1; i <= n - 2; i++) {
      const bY = pts[i].y;
      const bandH = 12;
      const gradId = `funnel-blend-grad-${i}`;

      /* average colour of the two adjacent stages */
      const fracsAbove = getSourceFractions(i - 1);
      const fracsBelow = getSourceFractions(i);
      const pickFirst = (arr) => (arr.length ? arr[0].color : '#888');
      const cAbove = pickFirst(fracsAbove);
      const cBelow = pickFirst(fracsBelow);

      /* parse hex → rgb helper */
      const hexToRgb = (hex) => {
        const h = hex.replace('#', '');
        return [parseInt(h.substring(0,2),16), parseInt(h.substring(2,4),16), parseInt(h.substring(4,6),16)];
      };
      const [r1,g1,b1] = hexToRgb(cAbove);
      const [r2,g2,b2] = hexToRgb(cBelow);
      const mr = Math.round((r1+r2)/2), mg = Math.round((g1+g2)/2), mb = Math.round((b1+b2)/2);

      const grad = document.createElementNS(svgNS, 'linearGradient');
      grad.setAttribute('id', gradId);
      grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0');
      grad.setAttribute('x2', '0'); grad.setAttribute('y2', '1');
      const stops = [
        { offset: '0%',   color: `rgba(${mr},${mg},${mb},0)` },
        { offset: '45%',  color: `rgba(${mr},${mg},${mb},0.15)` },
        { offset: '55%',  color: `rgba(${mr},${mg},${mb},0.15)` },
        { offset: '100%', color: `rgba(${mr},${mg},${mb},0)` },
      ];
      stops.forEach(s => {
        const stop = document.createElementNS(svgNS, 'stop');
        stop.setAttribute('offset', s.offset);
        stop.setAttribute('stop-color', s.color);
        grad.appendChild(stop);
      });
      defs.appendChild(grad);

      /* overlay rect */
      const maxLx = Math.min(pts[i-1].lx, pts[i].lx) - 4;
      const maxRx = Math.max(pts[i-1].rx, pts[i].rx) + 4;
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', maxLx);
      rect.setAttribute('y', bY - bandH / 2);
      rect.setAttribute('width', maxRx - maxLx);
      rect.setAttribute('height', bandH);
      rect.setAttribute('fill', `url(#${gradId})`);
      rect.setAttribute('pointer-events', 'none');
      svgEl.appendChild(rect);
    }
    svgEl.insertBefore(defs, svgEl.firstChild);
  }

  let funnelTooltipEl = document.getElementById('funnel-svg-tooltip');
  if (!funnelTooltipEl) {
    funnelTooltipEl = document.createElement('div');
    funnelTooltipEl.id = 'funnel-svg-tooltip';
    funnelTooltipEl.className = 'funnel-svg-tooltip';
    document.body.appendChild(funnelTooltipEl);
  }
  funnelTooltipEl.style.display = 'none';

  const stageItems = document.querySelectorAll('#jd-funnel-stages .jd-stage-item');
  const stagesContainer = document.getElementById('jd-funnel-stages');
  if (stagesContainer && stageItems.length === n) {
    stagesContainer.style.position = 'relative';
    stagesContainer.style.gap = '0';
    stagesContainer.style.height = H + 'px';
    stageItems.forEach((item, i) => {
      const segTop = ys[i];
      const segBot = i < n - 1 ? ys[i + 1] : H - padB;
      const segH = segBot - segTop;
      item.style.position = 'absolute';
      item.style.left = '0';
      item.style.right = '0';
      item.style.top = segTop + 'px';
      item.style.height = segH + 'px';
      item.style.display = 'flex';
      item.style.alignItems = 'center';
    });
  }

  let activeSegIdx = -1;

  function showTooltip(idx, clientX, clientY) {
    if (activeSegIdx === idx) {
      funnelTooltipEl.style.left = (clientX + 14) + 'px';
      funnelTooltipEl.style.top = (clientY - 10) + 'px';
      return;
    }
    activeSegIdx = idx;
    const label = stageLabels[idx];
    const count = stageCounts[idx];
    const breakdown = getBreakdownForStage(label);
    const rows = Object.entries(breakdown).map(([src, cnt]) => {
      const color = sourceColors[src] || '#888';
      return '<div class="funnel-tooltip-row"><span class="funnel-tooltip-dot" style="background:' + color + '"></span><span>' + src + '</span><strong>' + cnt + '</strong></div>';
    }).join('');

    funnelTooltipEl.innerHTML = '<div class="funnel-tooltip-title">' + label + ' <span>(' + count + ')</span></div>' + (rows || '<div class="funnel-tooltip-row"><span style="color:var(--color-text-faint)">No candidates</span></div>');
    funnelTooltipEl.style.display = 'block';
    funnelTooltipEl.style.left = (clientX + 14) + 'px';
    funnelTooltipEl.style.top = (clientY - 10) + 'px';

    svgEl.querySelectorAll('g[data-stage-idx]').forEach(g => {
      const gi = parseInt(g.getAttribute('data-stage-idx'));
      const paths = g.querySelectorAll('path');
      if (gi === idx) {
        paths.forEach(p => { p.setAttribute('opacity', '1'); p.style.filter = 'brightness(1.25)'; });
      } else {
        paths.forEach(p => { p.setAttribute('opacity', '0.9'); p.style.filter = ''; });
      }
    });
    stageItems.forEach((si, si_i) => {
      if (si_i === idx) si.classList.add('funnel-hover-active');
      else si.classList.remove('funnel-hover-active');
    });
  }

  function hideTooltip() {
    activeSegIdx = -1;
    funnelTooltipEl.style.display = 'none';
    svgEl.querySelectorAll('g[data-stage-idx] path').forEach(p => {
      p.setAttribute('opacity', '0.9');
      p.style.filter = '';
    });
    stageItems.forEach(si => si.classList.remove('funnel-hover-active'));
  }

  svgEl.addEventListener('mousemove', function(e) {
    const target = e.target;
    const g = target.closest ? target.closest('g[data-stage-idx]') : null;
    if (!g && target.tagName === 'path') {
      const parent = target.parentElement;
      if (parent && parent.tagName.toLowerCase() === 'g' && parent.hasAttribute('data-stage-idx')) {
        showTooltip(parseInt(parent.getAttribute('data-stage-idx')), e.clientX, e.clientY);
        return;
      }
    }
    if (g) {
      showTooltip(parseInt(g.getAttribute('data-stage-idx')), e.clientX, e.clientY);
    } else {
      hideTooltip();
    }
  });

  svgEl.addEventListener('mouseleave', function() {
    hideTooltip();
  });
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

  const wrap = svgEl.parentElement;
  const sRect = wrap ? wrap.getBoundingClientRect() : { width: 380, height: 220 };
  const W = Math.max(sRect.width || 380, 200);
  const H = Math.max(sRect.height || 220, 150);
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
  const bucketColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];

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
      <rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${bucketColors[i]}" rx="3" opacity="0.9"/>
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

  // Breadcrumbs: Client Portal Click
  const portalLink = document.getElementById('bc-portal-link');
  if (portalLink) {
    portalLink.addEventListener('click', () => {
      navigateToTab('jobs');
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
  if (headerActionBtn) {
    headerActionBtn.addEventListener('click', () => {
      if (AppState.activeTab === 'team') {
        openDrawer('member');
      } else {
        navigateToCreateJob();
      }
    });
  }

  // C. Drawer Close actions
  const drawerBackdrop = document.getElementById('drawer-backdrop');
  if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawers);
  
  const btnCloseDrawerJob = document.getElementById('btn-close-drawer-job');
  if (btnCloseDrawerJob) btnCloseDrawerJob.addEventListener('click', closeDrawers);
  
  const btnCloseDrawerMember = document.getElementById('btn-close-drawer-member');
  if (btnCloseDrawerMember) btnCloseDrawerMember.addEventListener('click', closeDrawers);
  
  const btnCloseDrawerViewJd = document.getElementById('btn-close-drawer-view-jd');
  if (btnCloseDrawerViewJd) btnCloseDrawerViewJd.addEventListener('click', closeDrawers);
  
  const btnSaveDrawerJd = document.getElementById('btn-save-drawer-jd');
  if (btnSaveDrawerJd) {
    btnSaveDrawerJd.addEventListener('click', () => {
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
  }

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

  window.toggleJobKebab = function(btn) {
    const dropdown = btn.nextElementSibling;
    const isOpen = dropdown.classList.contains('open');
    document.querySelectorAll('.job-kebab-dropdown.open').forEach(d => d.classList.remove('open'));
    if (!isOpen) dropdown.classList.add('open');
  };

  document.addEventListener('click', () => {
    document.querySelectorAll('.job-kebab-dropdown.open').forEach(d => d.classList.remove('open'));
  });

  window.handleJobKebab = function(jobId, action) {
    document.querySelectorAll('.job-kebab-dropdown.open').forEach(d => d.classList.remove('open'));
    const job = AppState.jobs.find(j => j.id === jobId);
    if (!job) return;
    switch (action) {
      case 'edit-name':
        openEditJobModal(jobId);
        break;
      case 'view-flow':
        openJobFlowView(jobId);
        break;
      case 'add-candidates':
        navigateToSourcing(jobId);
        break;
      case 'career-page': {
        job.listedOnCareer = !job.listedOnCareer;
        renderJobCards();
        const label = job.listedOnCareer ? 'listed on' : 'removed from';
        showPremiumToast(`"${job.cardName || job.roleName}" ${label} career page.`, 'success');
        break;
      }
      case 'duplicate': {
        const dup = JSON.parse(JSON.stringify(job));
        dup.id = 'JOB-' + Math.random().toString(36).substr(2, 8).toUpperCase();
        dup.cardName = (job.cardName || job.roleName) + ' (Copy)';
        dup.status = 'draft';
        dup.listedOnCareer = false;
        dup.created = new Date().toLocaleString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
        dup.pipeline = { total: 0, resume: 0, screening: 0, functional: 0 };
        AppState.jobs.push(dup);
        renderJobCards();
        updateJobsCounters();
        showPremiumToast(`Job duplicated as "${dup.cardName}".`, 'success');
        break;
      }
      case 'settings':
        navigateToJobDetail(jobId);
        setTimeout(() => {
          const qTab = document.querySelector('.jd-tab[data-jd-tab="questions"]');
          if (qTab) qTab.click();
        }, 100);
        break;
      case 'archive':
        job.status = 'archived';
        renderJobCards();
        updateJobsCounters();
        showPremiumToast(`"${job.cardName || job.roleName}" has been archived.`, 'success');
        break;
      case 'unarchive':
        job.status = 'published';
        renderJobCards();
        updateJobsCounters();
        showPremiumToast(`"${job.cardName || job.roleName}" has been restored.`, 'success');
        break;
      case 'delete': {
        const name = job.cardName || job.roleName;
        const idx = AppState.jobs.findIndex(j => j.id === jobId);
        if (idx === -1) break;
        AppState.jobs.splice(idx, 1);
        AppState.candidates = AppState.candidates.filter(c => c.jobApplied !== job.roleName && c.jobApplied !== job.cardName);
        saveStateToLocalStorage();
        setTimeout(() => {
          renderJobCards();
          updateJobsCounters();
          updateSummaryMetrics();
          showPremiumToast(`"${name}" has been permanently deleted.`, 'success');
        }, 0);
        break;
      }
    }
  };

  // Edit Job Modal logic
  let editJobModalTags = [];
  let editJobModalJobId = null;

  function openEditJobModal(jobId) {
    const job = AppState.jobs.find(j => j.id === jobId);
    if (!job) return;
    editJobModalJobId = jobId;
    editJobModalTags = Array.isArray(job.tags) ? [...job.tags] : [];

    const modal = document.getElementById('modal-edit-job');
    document.getElementById('modal-edit-job-name').value = job.cardName || job.roleName || '';
    document.getElementById('modal-edit-job-id').value = job.customJobId && job.customJobId !== '-' ? job.customJobId : '';
    renderEditJobTags();
    modal.style.display = '';
    setTimeout(() => document.getElementById('modal-edit-job-name').focus(), 50);
    soundEngine.playChime([392.00, 523.25], 0.12, 0.1);
  }

  function closeEditJobModal() {
    document.getElementById('modal-edit-job').style.display = 'none';
    editJobModalJobId = null;
    editJobModalTags = [];
    soundEngine.playClick();
  }

  function renderEditJobTags() {
    const list = document.getElementById('modal-edit-tags-list');
    list.innerHTML = editJobModalTags.map((tag, i) =>
      `<span class="modal-tag">${tag}<button class="modal-tag-remove" data-idx="${i}">×</button></span>`
    ).join('');
    list.querySelectorAll('.modal-tag-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        editJobModalTags.splice(parseInt(btn.dataset.idx), 1);
        renderEditJobTags();
      });
    });
  }

  const modalEditJobClose = document.getElementById('modal-edit-job-close');
  if (modalEditJobClose) modalEditJobClose.addEventListener('click', closeEditJobModal);
  
  const modalEditJob = document.getElementById('modal-edit-job');
  if (modalEditJob) {
    modalEditJob.addEventListener('click', (e) => {
      if (e.target.id === 'modal-edit-job') closeEditJobModal();
    });
  }

  const modalEditTagsInput = document.getElementById('modal-edit-tags-input');
  if (modalEditTagsInput) {
    modalEditTagsInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = e.target.value.replace(/,/g, '').trim();
        if (val && !editJobModalTags.includes(val)) {
          editJobModalTags.push(val);
          renderEditJobTags();
        }
        e.target.value = '';
      }
    });
  }

  const modalEditJobSave = document.getElementById('modal-edit-job-save');
  if (modalEditJobSave) {
    modalEditJobSave.addEventListener('click', () => {
    const job = AppState.jobs.find(j => j.id === editJobModalJobId);
    if (!job) return;
    const nameVal = document.getElementById('modal-edit-job-name').value.trim();
    if (!nameVal) {
      showPremiumToast('Job name is required.', 'error');
      return;
    }
    job.cardName = nameVal;
    const idVal = document.getElementById('modal-edit-job-id').value.trim();
    if (idVal) job.customJobId = idVal;
    job.tags = [...editJobModalTags];
    closeEditJobModal();
    renderJobCards();
    updateJobsCounters();
    showPremiumToast(`Job updated to "${nameVal}".`, 'success');
    });
  }

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

  const analyticsFilterBtn = document.querySelector('.btn-ctrl-filter');
  if (analyticsFilterBtn) {
    analyticsFilterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      soundEngine.playClick();
      const existing = analyticsFilterBtn.parentElement.querySelector('.analytics-filter-dropdown');
      if (existing) { existing.remove(); return; }
      document.querySelectorAll('.analytics-filter-dropdown').forEach(d => d.remove());

      const dd = document.createElement('div');
      dd.className = 'analytics-filter-dropdown';
      dd.addEventListener('click', ev => ev.stopPropagation());

      if (AppState.analyticsSubtab === 'jobs-data') {
        const statuses = ['Published', 'Draft', 'Archived'];
        dd.innerHTML = `
          <div class="afd-title">Filter by Status</div>
          <div class="afd-items">${statuses.map(s => `<label class="afd-item"><input type="checkbox" value="${s}" ${AppState.analyticsJobStatusFilter?.includes(s) ? 'checked' : ''} /><span>${s}</span></label>`).join('')}</div>
          <div class="afd-footer"><button class="afd-clear">Clear</button><button class="afd-apply">Apply</button></div>`;
        dd.querySelector('.afd-apply').addEventListener('click', () => {
          AppState.analyticsJobStatusFilter = [...dd.querySelectorAll('input:checked')].map(c => c.value);
          renderAnalyticsTable();
          dd.remove();
        });
        dd.querySelector('.afd-clear').addEventListener('click', () => {
          AppState.analyticsJobStatusFilter = [];
          renderAnalyticsTable();
          dd.remove();
        });
      } else {
        const stages = ['Resume', 'Screening', 'Functional', 'Hired', 'Rejected'];
        dd.innerHTML = `
          <div class="afd-title">Filter by Stage</div>
          <div class="afd-items">${stages.map(s => `<label class="afd-item"><input type="checkbox" value="${s}" ${AppState.analyticsCandStageFilter?.includes(s) ? 'checked' : ''} /><span>${s}</span></label>`).join('')}</div>
          <div class="afd-footer"><button class="afd-clear">Clear</button><button class="afd-apply">Apply</button></div>`;
        dd.querySelector('.afd-apply').addEventListener('click', () => {
          AppState.analyticsCandStageFilter = [...dd.querySelectorAll('input:checked')].map(c => c.value);
          renderAnalyticsTable();
          dd.remove();
        });
        dd.querySelector('.afd-clear').addEventListener('click', () => {
          AppState.analyticsCandStageFilter = [];
          renderAnalyticsTable();
          dd.remove();
        });
      }
      analyticsFilterBtn.parentElement.style.position = 'relative';
      analyticsFilterBtn.parentElement.appendChild(dd);
      const close = (ev) => { if (!dd.contains(ev.target) && ev.target !== analyticsFilterBtn) { dd.remove(); document.removeEventListener('click', close); } };
      setTimeout(() => document.addEventListener('click', close), 0);
    });
  }

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
        status: 'draft',
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
      saveStateToLocalStorage();
      
      // Close Drawer panel and reset form
      closeDrawers();
      createJobForm.reset();
      showPremiumToast(`Created job card "${roleName}" as Draft.`, "success");
      soundEngine.playChime([261.63, 329.63, 392.00, 523.25], 0.2, 0.08); // Melodic confirmation chime
      
      // Open Job Flow config view for the new draft job
      openJobFlowView(newJob.id, true);
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

  document.querySelectorAll('.settings-toggle:not([style*="pointer-events"])').forEach(toggle => {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      soundEngine.playClick();
      showPremiumToast('Setting updated.', 'success');
    });
  });

  const btnChangePass = document.getElementById('btn-change-password');
  if (btnChangePass) {
    btnChangePass.addEventListener('click', () => {
      soundEngine.playClick();
      showPremiumToast('Password change dialog would open here.', 'info');
    });
  }

  const btnExportData = document.getElementById('btn-export-data');
  if (btnExportData) {
    btnExportData.addEventListener('click', () => {
      soundEngine.playClick();
      showPremiumToast('Data export started. You will receive an email shortly.', 'success');
    });
  }

  const btnDeleteAccount = document.getElementById('btn-delete-account');
  if (btnDeleteAccount) {
    btnDeleteAccount.addEventListener('click', () => {
      soundEngine.playClick();
      showPremiumToast('Account deletion requires email confirmation.', 'info');
    });
  }

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

  document.addEventListener('click', () => {
    const popToggle = document.getElementById('pop-columns-toggle');
    const popTeam = document.getElementById('pop-columns-team');
    if (popToggle) popToggle.style.display = 'none';
    if (popTeam) popTeam.style.display = 'none';
    document.querySelectorAll('.stage-filter-dropdown').forEach(d => d.remove());
    document.querySelectorAll('.filter-chip.active-filter').forEach(c => { c.classList.remove('active-filter'); c._filterDropdown = null; });
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
      jobsBoardContainer.style.display = 'block';
      soundEngine.playClick();
      renderJobListView();
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
        const jobCandidates = filterCandidatesByDateRange(AppState.candidates).filter(
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
        createJobUploadedFile = null;
        preview.style.display = 'none';
        preview.innerHTML = '';
        if (jdDropzone) jdDropzone.classList.remove('has-file');
        if (jdFileInput) jdFileInput.value = '';
        soundEngine.playClick();
      });
    }
    if (jdDropzone) jdDropzone.classList.add('has-file');
    createJobUploadedFile = file;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'txt') {
      const reader = new FileReader();
      reader.onload = (ev) => { createJobUploadedText = ev.target.result; };
      reader.onerror = () => { createJobUploadedText = null; };
      reader.readAsText(file);
    } else {
      createJobUploadedText = null;
    }
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
      let textToProcess = pastedText || createJobUploadedText;
      const sourceName = createJobUploadedFileName || 'pasted text';

      if (!textToProcess && !createJobUploadedFile) {
        showPremiumToast("Upload a file or paste a job description first.", "error");
        return;
      }

      const originalHTML = btnContinue.innerHTML;
      btnContinue.disabled = true;

      if (!textToProcess && createJobUploadedFile) {
        btnContinue.innerHTML = `<div class="spinner-mini" style="display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin-mini 0.6s linear infinite;margin-right:6px;vertical-align:middle;"></div> Reading file...`;
        try {
          const formData = new FormData();
          formData.append('file', createJobUploadedFile);
          const parseResp = await fetch('/api/parse-file', { method: 'POST', body: formData });
          if (!parseResp.ok) throw new Error('Parse failed');
          const parseData = await parseResp.json();
          textToProcess = parseData.text;
          createJobUploadedText = parseData.text;
        } catch (e) {
          showPremiumToast("Failed to read file. Try pasting the text instead.", "error");
          btnContinue.disabled = false;
          btnContinue.innerHTML = originalHTML;
          return;
        }
      }

      if (!textToProcess) {
        showPremiumToast("Could not extract text from file. Try pasting it instead.", "error");
        btnContinue.disabled = false;
        btnContinue.innerHTML = originalHTML;
        return;
      }

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
          status: 'draft',
          customJobId: '-',
          experienceBand: parsed.experienceBand || 'Upto 2 Years',
          createdBy: 'Devasri',
          description: parsed.description || textToProcess.slice(0, 500),
          questions: [],
          pipeline: { total: 0, resume: 0, screening: 0, functional: 0 }
        };
        AppState.jobs.unshift(newJob);
        saveStateToLocalStorage();

        btnContinue.innerHTML = `<div class="spinner-mini" style="display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin-mini 0.6s linear infinite;margin-right:6px;vertical-align:middle;"></div> Generating interview pipeline...`;

        await enrichJobWithAI(newJob, textToProcess);

        showPremiumToast(`Job "${parsed.roleName}" created with AI-generated pipeline.`, "success");
        soundEngine.playChime([329.63, 392, 523.25, 659.25], 0.2, 0.08);
        openJobFlowView(newJob.id, true);
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

  let chartResizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(chartResizeTimer);
    chartResizeTimer = setTimeout(() => {
      if (AppState.activeTab === 'job-detail' && AppState.activeJobId) {
        const activeJob = AppState.jobs.find(j => j.id === AppState.activeJobId);
        if (activeJob) {
          const jobCandidates = filterCandidatesByDateRange(AppState.candidates).filter(
            c => c.jobApplied === activeJob.roleName || c.jobApplied === activeJob.cardName
          );
          drawFunnelSVG(activeJob, jobCandidates);
          drawScoreDistributionSVG(activeJob, jobCandidates);
        }
      }
    }, 150);
  });
  
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

  // Add Collaborator inside sourcing and job details
  const srcCollabBtn = document.getElementById('btn-src-collaborator');
  if (srcCollabBtn) {
    srcCollabBtn.addEventListener('click', () => {
      openDrawer('member');
    });
  }
  const jdCollabBtn = document.getElementById('btn-jd-collaborator');
  if (jdCollabBtn) {
    jdCollabBtn.addEventListener('click', () => {
      openDrawer('member');
    });
  }

  const isetBtn = document.getElementById('btn-interview-settings');
  const isetOverlay = document.getElementById('interview-settings-overlay');
  const isetClose = document.getElementById('btn-close-iset');
  const isetSave = document.getElementById('btn-save-iset');
  if (isetBtn && isetOverlay) {
    isetBtn.addEventListener('click', () => {
      isetOverlay.classList.add('open');
      soundEngine.playClick();
    });
    isetClose?.addEventListener('click', () => {
      isetOverlay.classList.remove('open');
      soundEngine.playClick();
    });
    isetOverlay.addEventListener('click', (e) => {
      if (e.target === isetOverlay) isetOverlay.classList.remove('open');
    });
    isetSave?.addEventListener('click', () => {
      isetOverlay.classList.remove('open');
      showPremiumToast('Interview settings saved.', 'success');
      soundEngine.playChime([523.25], 0.15);
    });
    isetOverlay.querySelectorAll('.settings-toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        soundEngine.playClick();
      });
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
    btnBrowseCsv.addEventListener('click', (e) => {
      e.stopPropagation();
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
    dropzoneCsv.addEventListener('click', (e) => {
      if (e.target !== btnBrowseCsv) {
        inputFileCsv.click();
      }
    });
  }

  const btnCsvCancel = document.getElementById('btn-csv-cancel');
  if (btnCsvCancel) {
    btnCsvCancel.addEventListener('click', () => {
      csvParsedCandidates = [];
      document.getElementById('csv-preview-box').style.display = 'none';
      if (inputFileCsv) inputFileCsv.value = '';
      soundEngine.playClick();
      const dropzone = document.getElementById('dropzone-csv');
      if (dropzone) dropzone.style.display = '';
      const footer = dropzone ? dropzone.parentElement.querySelector('.sourcing-panel-footer') : null;
      if (footer) footer.style.display = '';
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
    btnBrowseResumes.addEventListener('click', (e) => {
      e.stopPropagation();
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
    dropzoneResumes.addEventListener('click', (e) => {
      if (e.target !== btnBrowseResumes) {
        inputFileResumes.click();
      }
    });
  }

  const btnResumesCancel = document.getElementById('btn-resumes-cancel');
  if (btnResumesCancel) {
    btnResumesCancel.addEventListener('click', () => {
      uploadedFiles = [];
      document.getElementById('resumes-preview-box').style.display = 'none';
      if (inputFileResumes) inputFileResumes.value = '';
      soundEngine.playClick();
      const dropzone = document.getElementById('dropzone-resumes');
      if (dropzone) dropzone.style.display = '';
      const footer = dropzone ? dropzone.parentElement.querySelector('.sourcing-panel-footer') : null;
      if (footer) footer.style.display = '';
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

  const dateRangeSelect = document.getElementById('date-range-select');

  const analyticsDrBtn = document.getElementById('btn-analytics-daterange');
  const analyticsDrDrop = document.getElementById('analytics-daterange-dropdown');
  if (analyticsDrBtn && analyticsDrDrop) {
    analyticsDrBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      analyticsDrDrop.classList.toggle('open');
      soundEngine.playClick();
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#analytics-date-range-wrap')) analyticsDrDrop.classList.remove('open');
    });
    analyticsDrDrop.querySelectorAll('.dr-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        analyticsDrDrop.querySelectorAll('.dr-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        AppState.dateRange = btn.getAttribute('data-range');
        document.getElementById('analytics-daterange-label').textContent = btn.textContent;
        if (dateRangeSelect) dateRangeSelect.value = AppState.dateRange;
        const jdLabel = document.getElementById('jd-daterange-label');
        if (jdLabel) jdLabel.textContent = btn.textContent;
        const jdDrop = document.getElementById('jd-daterange-dropdown');
        if (jdDrop) jdDrop.querySelectorAll('.jd-dr-preset').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-range') === AppState.dateRange);
        });
        soundEngine.playClick();
        applyDateRangeGlobally();
        analyticsDrDrop.classList.remove('open');
      });
    });
  }

  const dateFrom = document.getElementById('date-from');
  const dateTo = document.getElementById('date-to');
  const drApply = document.getElementById('dr-apply-custom');
  if (dateFrom && dateTo && drApply) {
    drApply.addEventListener('click', () => {
      AppState.dateRange = 'custom';
      AppState.customDateFrom = dateFrom.value;
      AppState.customDateTo = dateTo.value;
      if (dateRangeSelect) dateRangeSelect.value = 'custom';
      document.getElementById('analytics-daterange-label').textContent = 'Custom Range';
      if (analyticsDrDrop) {
        analyticsDrDrop.querySelectorAll('.dr-preset').forEach(b => b.classList.remove('active'));
        analyticsDrDrop.classList.remove('open');
      }
      soundEngine.playClick();
      applyDateRangeGlobally();
    });
  }

  // Job Detail Date Range dropdown
  const jdDrBtn = document.getElementById('btn-jd-daterange');
  const jdDrDrop = document.getElementById('jd-daterange-dropdown');
  if (jdDrBtn && jdDrDrop) {
    jdDrBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      jdDrDrop.classList.toggle('open');
      soundEngine.playClick();
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#jd-date-range-wrap')) jdDrDrop.classList.remove('open');
    });
    jdDrDrop.querySelectorAll('.jd-dr-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        jdDrDrop.querySelectorAll('.jd-dr-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        AppState.dateRange = btn.getAttribute('data-range');
        document.getElementById('jd-daterange-label').textContent = btn.textContent;
        // sync analytics bar dropdown
        const sel = document.getElementById('date-range-select');
        if (sel) sel.value = AppState.dateRange;
        soundEngine.playClick();
        applyDateRangeGlobally();
        jdDrDrop.classList.remove('open');
      });
    });
    const jdDateFrom = document.getElementById('jd-date-from');
    const jdDateTo = document.getElementById('jd-date-to');
    if (jdDateFrom && jdDateTo) {
      [jdDateFrom, jdDateTo].forEach(inp => {
        inp.addEventListener('change', () => {
          jdDrDrop.querySelectorAll('.jd-dr-preset').forEach(b => b.classList.remove('active'));
          AppState.dateRange = 'custom';
          AppState.customDateFrom = jdDateFrom.value;
          AppState.customDateTo = jdDateTo.value;
          document.getElementById('jd-daterange-label').textContent = 'Custom';
          // sync analytics bar dropdown
          const sel2 = document.getElementById('date-range-select');
          if (sel2) sel2.value = 'custom';
          const drc = document.getElementById('date-range-custom');
          if (drc) drc.style.display = 'flex';
          if (document.getElementById('date-from')) document.getElementById('date-from').value = jdDateFrom.value;
          if (document.getElementById('date-to')) document.getElementById('date-to').value = jdDateTo.value;
          soundEngine.playClick();
          applyDateRangeGlobally();
        });
      });
    }
  }

  const btnLogout = document.querySelector('.btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      soundEngine.playClick();
      showPremiumToast("You have been logged out.", "success");
      setTimeout(() => { window.location.reload(); }, 1200);
    });
  }

  const btnUpgrade = document.querySelector('.btn-upgrade');
  if (btnUpgrade) {
    btnUpgrade.addEventListener('click', () => {
      soundEngine.playClick();
      showPremiumToast("Plan upgrade flow coming soon. Contact sales for Enterprise access.", "info");
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
window.navigateToSourcing = navigateToSourcing;

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
      <td><strong>${cand.name}</strong></td>
      <td>${cand.email}</td>
      <td>${cand.phone || '-'}</td>
      <td><span class="upload-file-status-badge done">Ready to Sync</span></td>
    </tr>
  `).join('');

  box.style.display = 'block';
  const dropzone = document.getElementById('dropzone-csv');
  if (dropzone) dropzone.style.display = 'none';
  const footer = dropzone ? dropzone.parentElement.querySelector('.sourcing-panel-footer') : null;
  if (footer) footer.style.display = 'none';
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
  const dropzone = document.getElementById('dropzone-csv');
  if (dropzone) dropzone.style.display = '';
  const footer = dropzone ? dropzone.parentElement.querySelector('.sourcing-panel-footer') : null;
  if (footer) footer.style.display = '';

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
function addCandidateToAppState(name, email, phone, job, resumeText) {
  const identity = extractResumeIdentity(resumeText, name);
  const candidateName = identity.name || normalizeCandidateName(name) || name;
  const candidateEmail = identity.email || email || createPlaceholderEmail(candidateName);
  const candidatePhone = identity.phone || phone || '';

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
  const score = '—';

  AppState.candidates.push({
    id: candId,
    name: candidateName,
    email: candidateEmail,
    phone: candidatePhone,
    linkedin: identity.linkedin || '',
    resumeIdentitySource: identity.source,
    jobApplied: job.roleName,
    status: status,
    score: score,
    registeredOn: dateStr
  });

  if (resumeText && !isGarbageText(resumeText)) {
    resumeTextCache[candId] = resumeText;
    resumeIdentityCache[candId] = identity;
  }

  return candId;
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
      b.style.setProperty('--wave-height', (Math.floor(Math.random() * 70 + 20)) / 100);
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
        if (idx <= activeIndex) {
          bar.classList.add('played');
        } else {
          bar.classList.remove('played');
        }
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
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  } else {
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.substring(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }
  }
  return cleaned.trim();
}

async function enrichJobWithAI(job, jdText) {
  const descriptionText = jdText || job.description || '';
  if (!descriptionText.trim()) return;

  const criteriaPrompt = `You are an expert HR analyst. Given a job description, extract structured resume screening criteria, recruiter screening parameters, and audit the job description for clarity, expectations, bias, and optimization.

Return ONLY valid JSON with this exact structure:
{
  "resumeCriteria": {
    "mustHave": ["3-5 strings: essential skills/experience the candidate MUST demonstrate"],
    "redFlags": ["3-5 strings: disqualifying traits or gaps that should reject a candidate"],
    "goodToHave": ["3-5 strings: bonus qualifications that strengthen a candidate"],
    "goodToHaveMinMatch": 1
  },
  "screeningParams": [
    { "category": "Experience", "params": [
      { "name": "Total Experience", "required": true, "flexibility": "", "preferredResponse": "specific requirement" },
      { "name": "Relevant Experience", "required": true, "flexibility": "", "preferredResponse": "specific requirement" }
    ]},
    { "category": "Location", "params": [
      { "name": "Current Location", "required": false, "flexibility": "", "preferredResponse": "Remote or flexible" },
      { "name": "Ready to relocate", "required": false, "flexibility": "", "preferredResponse": "Flexible" }
    ]},
    { "category": "Compensation", "params": [
      { "name": "Current CTC", "required": false, "flexibility": "", "preferredResponse": "Market rate" },
      { "name": "Expected CTC", "required": false, "flexibility": "", "preferredResponse": "Competitive" }
    ]},
    { "category": "Availability", "params": [
      { "name": "Notice Period", "required": true, "flexibility": "", "preferredResponse": "30 days or less" }
    ]}
  ],
  "jdAnalysis": {
    "grade": "Letter grade (A, B+, B, C, D) representing job description quality",
    "readability": "Readability evaluation (e.g. Clear, Complex, Dense)",
    "warnings": {
      "unrealisticExpectations": ["List specific unrealistic expectations, conflicting requirements, or none"],
      "biasFluff": ["List flagged corporate jargon, clichés, or biased phrasing, or none"]
    },
    "marketContext": "Summary of talent supply for the required skills (1-2 sentences)",
    "recommendedOptimizations": ["Actionable improvements to the JD, list 2-3 items"]
  }
}

Tailor every field specifically to the role. Do not use generic placeholders.`;

  const questionsPrompt = `You are a senior technical interviewer. Given a job description, generate 5 high-quality interview questions.

Return ONLY valid JSON with this exact structure:
{
  "questions": [
    {
      "id": "q-gen-1",
      "type": "technical OR behavioral OR situational",
      "question": "the interview question text",
      "difficulty": "beginner OR intermediate OR advanced",
      "rubric": "what a strong answer should demonstrate",
      "follow_ups": ["follow-up question 1", "follow-up question 2"]
    }
  ]
}

Rules:
- Generate exactly 5 questions: 2 technical, 2 behavioral, 1 situational
- Vary difficulty: 1 beginner, 3 intermediate, 1 advanced
- Each question must have exactly 2 follow-ups
- Tailor every question specifically to the role described
- Use ids: q-gen-1 through q-gen-5`;

  const truncatedJD = descriptionText.slice(0, 2500);

  const [criteriaResult, questionsResult] = await Promise.allSettled([
    callDeepSeekAPI([
      { role: 'system', content: criteriaPrompt },
      { role: 'user', content: `Job Description:\n\n${truncatedJD}` }
    ], true),
    callDeepSeekAPI([
      { role: 'system', content: questionsPrompt },
      { role: 'user', content: `Job Description:\n\n${truncatedJD}` }
    ], true)
  ]);

  if (criteriaResult.status === 'fulfilled') {
    try {
      const parsed = JSON.parse(sanitizeJSONResponse(criteriaResult.value));
      if (parsed.resumeCriteria) {
        job.resumeCriteria = {
          mustHave: parsed.resumeCriteria.mustHave || [],
          redFlags: parsed.resumeCriteria.redFlags || [],
          goodToHave: parsed.resumeCriteria.goodToHave || [],
          goodToHaveMinMatch: parsed.resumeCriteria.goodToHaveMinMatch || 1
        };
      }
      if (parsed.screeningParams && Array.isArray(parsed.screeningParams)) {
        job.screeningParams = parsed.screeningParams;
      }
      if (parsed.jdAnalysis) {
        job.jdAnalysis = parsed.jdAnalysis;
      } else {
        job.jdAnalysis = auditJobDescriptionLocally(descriptionText);
      }
    } catch (e) {
      console.error('Failed to parse criteria response:', e);
      job.jdAnalysis = auditJobDescriptionLocally(descriptionText);
    }
  } else {
    job.jdAnalysis = auditJobDescriptionLocally(descriptionText);
    if (!job.resumeCriteria) {
      job.resumeCriteria = {
        mustHave: ["Relevant experience in this domain", "Excellent verbal and written communication", "Core technical competency"],
        redFlags: ["Frequent unexplained job hopping", "Lack of relevant functional background"],
        goodToHave: ["Professional certifications", "Advanced degree or specialization"],
        goodToHaveMinMatch: 1
      };
    }
    if (!job.screeningParams) {
      job.screeningParams = [
        { "category": "Experience", "params": [
          { "name": "Total Experience", "required": true, "flexibility": "None", "preferredResponse": "Meets minimum years" }
        ]},
        { "category": "Availability", "params": [
          { "name": "Notice Period", "required": true, "flexibility": "Flexible", "preferredResponse": "30 days or less" }
        ]}
      ];
    }
  }

  if (questionsResult.status === 'fulfilled') {
    try {
      const parsed = JSON.parse(sanitizeJSONResponse(questionsResult.value));
      if (parsed.questions && Array.isArray(parsed.questions)) {
        job.questions = parsed.questions;
      } else {
        job.questions = generateQuestionsLocally(job);
      }
    } catch (e) {
      console.error('Failed to parse questions response:', e);
      job.questions = generateQuestionsLocally(job);
    }
  } else {
    job.questions = generateQuestionsLocally(job);
  }

  if (!job.pipelineConfig) {
    job.pipelineConfig = {
      careerPage: { enabled: true, listed: true },
      resumeAnalysis: { enabled: true },
      recruiterScreening: { enabled: true },
      functionalInterview: { enabled: true }
    };
  } else {
    if (job.resumeCriteria) job.pipelineConfig.resumeAnalysis = { enabled: true };
    if (job.screeningParams) job.pipelineConfig.recruiterScreening = { enabled: true };
    if (job.questions?.length) job.pipelineConfig.functionalInterview = { enabled: true };
  }

  job.applicationFields = job.applicationFields || ['Current Location', 'Expected CTC', 'Notice Period'];

  saveStateToLocalStorage();
}

function auditJobDescriptionLocally(jdText) {
  const text = jdText || '';
  const warnings = {
    unrealisticExpectations: [],
    biasFluff: []
  };
  const recommendedOptimizations = [];
  
  const charCount = text.length;
  let lengthRating = 'Good';
  if (charCount < 300) {
    lengthRating = 'Too Short';
    warnings.unrealisticExpectations.push("The description is extremely brief, which might not attract quality candidates.");
    recommendedOptimizations.push("Expand the job description to detail daily responsibilities and company culture.");
  } else if (charCount > 3000) {
    lengthRating = 'Too Long';
    warnings.unrealisticExpectations.push("The description is very dense, which might reduce candidate completion rates.");
    recommendedOptimizations.push("Simplify the layout and bullet points to focus on the core requirements.");
  }

  const lines = text.split('\n');
  const bulletCount = lines.filter(l => /^[*-•]|\d+\./.test(l.trim())).length;
  if (bulletCount < 3) {
    warnings.unrealisticExpectations.push("Lack of structured lists or bullet points for key requirements.");
    recommendedOptimizations.push("Use structured bullet points for 'Must-Have' and 'Nice-to-Have' skills to improve readability.");
  }

  const fluffKeywords = [
    { word: 'fast-paced', label: '"fast-paced" (can imply high burnout / chaotic environment)' },
    { word: 'rockstar', label: '"rockstar" (cliché, can discourage diverse candidates)' },
    { word: 'ninja', label: '"ninja" (unprofessional cliché)' },
    { word: 'guru', label: '"guru" (unprofessional cliché)' },
    { word: 'wear many hats', label: '"wear many hats" (often signals poor role definition)' },
    { word: 'dynamic', label: '"dynamic" (overused filler word)' },
    { word: 'self-starter', label: '"self-starter" (cliché, implies lack of onboarding)' },
    { word: 'synergy', label: '"synergy" (corporate jargon)' },
    { word: 'paradigm', label: '"paradigm" (corporate jargon)' }
  ];
  fluffKeywords.forEach(k => {
    if (new RegExp(`\\b${k.word}\\b`, 'i').test(text)) {
      warnings.biasFluff.push(`Flagged cliché: ${k.label}`);
    }
  });

  const expMatches = text.match(/(\d+)\s*\+?\s*(?:-\s*\d+)?\s*(?:years?|yrs?)/gi);
  if (expMatches) {
    expMatches.forEach(match => {
      const years = parseInt(match);
      if (years > 8) {
        warnings.unrealisticExpectations.push(`High experience requirement: "${match}". This might severely restrict the talent pool.`);
      }
    });
  }

  if (/next\.js|nextjs/i.test(text) && /1[0-9]\s*\+?\s*years?/i.test(text)) {
    warnings.unrealisticExpectations.push("Contradictory requirement: Requesting 10+ years of Next.js experience is unrealistic as the framework's mainstream adoption is more recent.");
  }
  if (/tailwind/i.test(text) && /1[0-9]\s*\+?\s*years?/i.test(text)) {
    warnings.unrealisticExpectations.push("Contradictory requirement: Requesting 10+ years of Tailwind CSS experience is unrealistic.");
  }

  let score = 90;
  score -= warnings.unrealisticExpectations.length * 10;
  score -= warnings.biasFluff.length * 5;
  if (charCount < 400 || charCount > 4000) score -= 10;
  if (bulletCount < 3) score -= 10;

  let grade = 'A';
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B+';
  else if (score >= 70) grade = 'B';
  else if (score >= 60) grade = 'C+';
  else if (score >= 50) grade = 'C';
  else grade = 'D';

  let readability = 'Clear';
  if (charCount > 2500 || warnings.unrealisticExpectations.length > 2) {
    readability = 'Complex';
  } else if (charCount < 400) {
    readability = 'Sparse';
  }

  if (recommendedOptimizations.length === 0) {
    recommendedOptimizations.push("Maintain current clear structure and precise criteria.");
    recommendedOptimizations.push("Ensure compensation brackets are discussed early in screening.");
  }

  return {
    grade,
    readability,
    warnings,
    marketContext: "Moderate talent supply. Most candidates with these technical keywords are actively sourced in the market.",
    recommendedOptimizations
  };
}

async function optimizeJobDescriptionWithAI(job, container) {
  const btn = container.querySelector('.btn-jd-optimize-ai');
  if (!btn) return;
  const originalLabel = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="ra-spinner"></span> Optimizing...`;
  
  soundEngine.playChime([392, 440], 0.08, 0.1);

  const systemPrompt = `You are a senior talent acquisition specialist. Optimize this job description to make it professional, clear, and realistic. 
Specifically:
- Remove corporate fluff/clichés like "rockstar", "ninja", "ninja developer", "dynamic self-starter", "wear many hats".
- Ensure the requirements (must-have skills) are realistic and consolidated to 3-5 clear points.
- Structure it clearly with sections for Role Overview, Key Responsibilities, and Qualifications.
- Return ONLY the optimized job description text — no commentary, no JSON, no markdown headers, no introductory or concluding chat remarks.`;

  try {
    const improved = await callDeepSeekAPI([
      { role: "system", content: systemPrompt },
      { role: "user", content: `Optimize this job description:\n\n${job.description}` }
    ]);
    
    job.description = improved.trim();
    showPremiumToast("Job description optimized with AI.", "success");
    
    await enrichJobWithAI(job, job.description);
    
    renderDeepAnalysisPane(job, container);
    
    const rawDesc = document.getElementById('jd-raw-description');
    if (rawDesc) rawDesc.value = job.description;

    soundEngine.playChime([523.25, 659.25], 0.12, 0.08);
  } catch (err) {
    console.error("JD optimization failed:", err);
    let cleanText = job.description;
    cleanText = cleanText.replace(/\b(?:rockstar|ninja|guru|ninja developer|wear many hats)\b/gi, 'professional');
    job.description = cleanText;
    await enrichJobWithAI(job, job.description);
    renderDeepAnalysisPane(job, container);
    showPremiumToast("Local optimization applied (API unavailable).", "info");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalLabel;
  }
}

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

  let summary = `We have analyzed ${analyzed.length} candidate(s) for the <strong>${job.roleName}</strong> position. The average match score is <strong>${avgScore}%</strong>. `;
  
  if (topCand) {
    summary += `<strong>${topCand.name}</strong> is the top-performing candidate with a match score of <strong>${topScore}%</strong>. `;
  }

  if (mostMissing) {
    const pct = Math.round((missingCounts[mostMissing] / analyzed.length) * 100);
    summary += `A significant portion of the candidate pool (${pct}%) lacks experience in <strong>${mostMissing}</strong>, which may be a focus area during recruiter screens. `;
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
              ${mustHaves.map((s, i) => `<th class="matrix-header-cell must" title="Must-Have: ${s}">M${i+1}</th>`).join('')}
              ${goodToHaves.map((s, i) => `<th class="matrix-header-cell good" title="Good-to-Have: ${s}">G${i+1}</th>`).join('')}
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
                    ${c.name}
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
                    ${!isAnalyzed ? '<span style="color: var(--color-text-faint);">—</span>' : (hasRedFlags ? `<span style="color: #ef4444; font-size: 1.1rem;" title="${analysis.redFlagsDetected.join(', ')}">⚠</span>` : '<span style="color: #10b981;">✓</span>')}
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
          currentStagedQuestions = questionsArr.map((q, idx) => ({
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
  
  stagingList.innerHTML = currentStagedQuestions.map((q, idx) => `
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
      currentStagedQuestions[idx].type = sel.value;
    });
  });
  stagingList.querySelectorAll('.staging-diff-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const idx = parseInt(sel.getAttribute('data-idx'));
      currentStagedQuestions[idx].difficulty = sel.value;
    });
  });

  stagingList.querySelectorAll('.btn-staging-discard-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'));
      currentStagedQuestions.splice(idx, 1);
      if (currentStagedQuestions.length === 0) {
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
    job.questions = [...currentStagedQuestions];
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
    job.questions = job.questions.concat(currentStagedQuestions);
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

// ==========================================
// CRYSTAL GLASS OVERDRIVE: DYNAMIC INTERACTIVE ANIMATIONS
// ==========================================
function initCrystalAnimations() {
  // 1. WebGL Fullscreen fluid background shader setup
  const canvas = document.getElementById('crystal-shader-canvas');
  if (canvas) {
    // Guard against multiple initializations on the same canvas (e.g. DOM/Vite rebuild events)
    if (canvas.dataset.initialized) return;
    canvas.dataset.initialized = 'true';

    try {
      const container = canvas.parentElement;
      const scene = new THREE.Scene();
      
      // Camera - Full screen plane OrthographicCamera (depth Z centered at -1 to 1 to prevent mesh clipping)
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
      camera.position.z = 1;
      
      // Renderer - initialize WebGL
      const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance"
      });
      
      // Determine initial viewport dimensions safely via window metrics to prevent DOM size race conditions
      const viewWidth = window.innerWidth;
      const viewHeight = window.innerHeight;
      renderer.setSize(viewWidth, viewHeight);
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
        uniform float u_theme; // 0.0 for dark (black/grey), 1.0 for light (off-white/grey)
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
          
          // Scale coordinates by 4.0 so the noise cycles across multiple cells and textures the screen
          vec2 p = uv * 4.0;
          
          // Warping Step 1
          vec2 q = vec2(0.0);
          q.x = fbm(p + 0.08 * u_time);
          q.y = fbm(p + vec2(1.0) + 0.06 * u_time);
          
          // Warping Step 2
          vec2 r = vec2(0.0);
          r.x = fbm(p + 1.2 * q + vec2(1.7, 9.2) + 0.12 * u_time);
          r.y = fbm(p + 1.2 * q + vec2(8.3, 2.8) + 0.09 * u_time);
          
          float f = fbm(p + 1.1 * r);
          
          // Theme 1 (Dark Mode): Blackish grey tones
          vec3 darkBg = vec3(0.0, 0.0, 0.0);
          vec3 darkGrey1 = vec3(0.06, 0.06, 0.07);
          vec3 darkGrey2 = vec3(0.04, 0.04, 0.045);
          vec3 darkGrey3 = vec3(0.08, 0.08, 0.085);

          vec3 darkColor = mix(darkBg, darkGrey1, f * 0.7);
          darkColor = mix(darkColor, darkGrey2, r.x * 0.5);
          darkColor = mix(darkColor, darkGrey3, q.y * 0.3);

          // Theme 2 (Light Mode): Off-white with subtle grey hues
          vec3 lightBg = vec3(0.98, 0.98, 0.975);
          vec3 lightGrey1 = vec3(0.94, 0.94, 0.935);
          vec3 lightGrey2 = vec3(0.96, 0.955, 0.95);
          vec3 lightGrey3 = vec3(0.92, 0.92, 0.915);

          vec3 lightColor = mix(lightBg, lightGrey1, f * 0.4);
          lightColor = mix(lightColor, lightGrey2, r.y * 0.3);
          lightColor = mix(lightColor, lightGrey3, q.x * 0.2);
          
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
        u_resolution: { value: new THREE.Vector2(viewWidth, viewHeight) },
        u_theme: { value: themeState.value },
        u_mouse: { value: new THREE.Vector2(0, 0) }
      };
      
      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide
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
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;
        renderer.setSize(newWidth, newHeight);
        if (uniforms.u_resolution) {
          uniforms.u_resolution.value.set(newWidth, newHeight);
        }
      });
      
      container.classList.add('has-shader');
      
    } catch (err) {
      console.warn("Crystal shader failed to initialize, falling back to CSS static orbs:", err);
      // Clean up initialization status on failure
      canvas.removeAttribute('data-initialized');
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
  const isCrystalTheme = !!document.getElementById('crystal-shader-canvas');

  function applyTactileTiltEffects() {
    if (isCrystalTheme) return;

    const cards = document.querySelectorAll(
      '.job-card, .card-metric, .panel-setting, .agent-card, .terminal-box, .table-card, .panel-preview, .sourcing-tab-card'
    );

    cards.forEach(card => {
      if (card.dataset.tiltInitialized) return;
      card.dataset.tiltInitialized = 'true';

      card.style.setProperty('--shine-x', '50%');
      card.style.setProperty('--shine-y', '50%');

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const xc = rect.width / 2;
        const yc = rect.height / 2;

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

  return () => {
    controller.abort();
    
    activeAnimationFrames.forEach(id => originalCancelAnimationFrame(id));
    activeAnimationFrames.clear();

    activeRenderers.forEach(r => {
      try { r.dispose(); } catch(e) {}
    });
    activeRenderers.clear();

    activeObservers.forEach(obs => {
      try { obs.disconnect(); } catch(e) {}
    });
    activeObservers.clear();

    // Clean up window attachments to avoid memory leaks or cross-page pollution
    delete window.navigateToJobDetail;
    delete window.openReportDrawerForCandidate;
    delete window.AppState;
    delete window.openJobFlowView;
    delete window.openJobDescriptionDrawer;
    delete window.toggleJobKebab;
    delete window.handleJobKebab;
    delete window.navigateToSourcing;
    delete window.removeCandidateFromQueue;
  };
}
