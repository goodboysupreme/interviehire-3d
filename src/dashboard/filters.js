export function openScheduleModal(candidateName, mode, callback) {
  const existing = document.getElementById('schedule-modal-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'schedule-modal-overlay';
  overlay.className = 'schedule-modal-overlay';
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];
  overlay.innerHTML = `
    <div class="schedule-modal">
      <h3>${mode === 'reschedule' ? 'Reschedule' : 'Schedule'} Interview — ${candidateName}</h3>
      <div class="schedule-form-group">
        <label>Date</label>
        <input type="date" id="sched-date" value="${dateStr}" />
      </div>
      <div class="schedule-form-group">
        <label>Time</label>
        <input type="time" id="sched-time" value="10:00" />
      </div>
      <div class="schedule-form-group">
        <label>Duration</label>
        <select id="sched-duration" style="padding:8px 12px;background:rgba(0,0,0,0.2);border:1px solid var(--glass-border);border-radius:8px;color:var(--color-text-primary);font-size:0.82rem;outline:none;">
          <option value="15">15 minutes</option>
          <option value="30" selected>30 minutes</option>
          <option value="45">45 minutes</option>
          <option value="60">60 minutes</option>
        </select>
      </div>
      <div class="schedule-modal-actions">
        <button class="btn-schedule-cancel" id="sched-cancel">Cancel</button>
        <button class="btn-schedule-confirm" id="sched-confirm">Confirm</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('sched-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('sched-confirm').addEventListener('click', () => {
    const date = document.getElementById('sched-date').value;
    const time = document.getElementById('sched-time').value;
    overlay.remove();
    if (callback) callback(date, time);
    showPremiumToast(`Interview ${mode === 'reschedule' ? 'rescheduled' : 'scheduled'} for ${candidateName} on ${date} at ${time}.`, 'success');
    soundEngine.playChime([523.25, 659.25], 0.15, 0.08);
  });
}

export function buildFilterDropdown(chip, type, candidates, stageKey) {
  if (chip._filterDropdown) { chip._filterDropdown.remove(); chip._filterDropdown = null; chip.classList.remove('active-filter'); return; }
  document.querySelectorAll('.stage-filter-dropdown').forEach(d => d.remove());
  document.querySelectorAll('.filter-chip.active-filter').forEach(c => { c.classList.remove('active-filter'); c._filterDropdown = null; });

  const dd = document.createElement('div');
  dd.className = 'stage-filter-dropdown';
  dd.addEventListener('click', e => e.stopPropagation());

  const filters = AppState.stageFilters[stageKey];

  if (type === 'interviewStatus') {
    const statuses = ['Completed', 'Incomplete', 'Evaluating', 'Attempting', 'Not Started', 'Slot Missed'];
    const counts = {};
    statuses.forEach(s => { counts[s] = candidates.filter(c => c.interviewStatus === s).length; });
    dd.innerHTML = `
      <div class="sfd-search"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" placeholder="Interview Status" /></div>
      <div class="sfd-items">${statuses.map(s => `<label class="sfd-item"><input type="checkbox" value="${s}" ${filters.interviewStatus.includes(s) ? 'checked' : ''} /><span class="sfd-item-label">${s}</span><span class="sfd-item-count">${counts[s]}</span></label>`).join('')}</div>
      <div class="sfd-footer"><button class="sfd-clear-btn">Clear filters</button></div>`;
    dd.querySelectorAll('input[type=checkbox]').forEach(cb => cb.addEventListener('change', () => {
      filters.interviewStatus = [...dd.querySelectorAll('input[type=checkbox]:checked')].map(c => c.value);
      const activeJob = AppState.jobs.find(j => j.id === AppState.activeJobId);
      if (activeJob) renderJobDetailPanes(activeJob);
    }));
    dd.querySelector('.sfd-clear-btn').addEventListener('click', () => { filters.interviewStatus = []; const activeJob = AppState.jobs.find(j => j.id === AppState.activeJobId); if (activeJob) renderJobDetailPanes(activeJob); });
  } else if (type === 'cheatProb') {
    const levels = ['High', 'Medium', 'Low'];
    const counts = {};
    levels.forEach(l => { counts[l] = candidates.filter(c => c.cheatProbability === l).length; });
    dd.innerHTML = `
      <div class="sfd-search"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" placeholder="Cheat Probability" /></div>
      <div class="sfd-items">${levels.map(l => `<label class="sfd-item"><input type="checkbox" value="${l}" ${filters.cheatProb.includes(l) ? 'checked' : ''} /><span class="sfd-item-label">${l}</span><span class="sfd-item-count">${counts[l]}</span></label>`).join('')}</div>
      <div class="sfd-footer"><button class="sfd-clear-btn">Clear filters</button></div>`;
    dd.querySelectorAll('input[type=checkbox]').forEach(cb => cb.addEventListener('change', () => {
      filters.cheatProb = [...dd.querySelectorAll('input[type=checkbox]:checked')].map(c => c.value);
      const activeJob = AppState.jobs.find(j => j.id === AppState.activeJobId); if (activeJob) renderJobDetailPanes(activeJob);
    }));
    dd.querySelector('.sfd-clear-btn').addEventListener('click', () => { filters.cheatProb = []; const activeJob = AppState.jobs.find(j => j.id === AppState.activeJobId); if (activeJob) renderJobDetailPanes(activeJob); });
  } else if (type === 'recruiterScreening') {
    const vals = ['Good fit', 'Moderate fit', 'Poor fit'];
    const counts = {};
    vals.forEach(v => { counts[v] = candidates.filter(c => c.recruiterScreening === v).length; });
    dd.innerHTML = `
      <div class="sfd-search"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" placeholder="Recruiter Screening" /></div>
      <div class="sfd-items">${vals.map(v => `<label class="sfd-item"><input type="checkbox" value="${v}" ${filters.recruiterScreening.includes(v) ? 'checked' : ''} /><span class="sfd-item-label">${v}</span><span class="sfd-item-count">${counts[v]}</span></label>`).join('')}</div>
      <div class="sfd-footer"><button class="sfd-clear-btn">Clear filters</button></div>`;
    dd.querySelectorAll('input[type=checkbox]').forEach(cb => cb.addEventListener('change', () => {
      filters.recruiterScreening = [...dd.querySelectorAll('input[type=checkbox]:checked')].map(c => c.value);
      const activeJob = AppState.jobs.find(j => j.id === AppState.activeJobId); if (activeJob) renderJobDetailPanes(activeJob);
    }));
    dd.querySelector('.sfd-clear-btn').addEventListener('click', () => { filters.recruiterScreening = []; const activeJob = AppState.jobs.find(j => j.id === AppState.activeJobId); if (activeJob) renderJobDetailPanes(activeJob); });
  } else if (type === 'interviewScore') {
    dd.innerHTML = `
      <div class="sfd-range-row">
        <label>Interview score</label>
        <input type="number" class="sfd-range-input" id="sfd-score-min" value="${filters.scoreMin ?? 0}" min="0" max="100" />
        <span class="sfd-range-sep">to</span>
        <input type="number" class="sfd-range-input" id="sfd-score-max" value="${filters.scoreMax ?? 100}" min="0" max="100" />
      </div>
      <div class="sfd-actions-row">
        <button class="sfd-btn-clear">Clear</button>
        <button class="sfd-btn-apply">Apply</button>
      </div>`;
    dd.querySelector('.sfd-btn-apply').addEventListener('click', () => {
      filters.scoreMin = parseInt(dd.querySelector('#sfd-score-min').value) || 0;
      filters.scoreMax = parseInt(dd.querySelector('#sfd-score-max').value) || 100;
      const activeJob = AppState.jobs.find(j => j.id === AppState.activeJobId); if (activeJob) renderJobDetailPanes(activeJob);
    });
    dd.querySelector('.sfd-btn-clear').addEventListener('click', () => { filters.scoreMin = null; filters.scoreMax = null; const activeJob = AppState.jobs.find(j => j.id === AppState.activeJobId); if (activeJob) renderJobDetailPanes(activeJob); });
  } else if (type === 'actions') {
    const acts = ['Shortlisted', 'Rejected', 'Waitlisted', 'Panel Shortlisted', 'Panel Rejected', 'Panel Waitlisted', 'Pending Action'];
    dd.innerHTML = `
      <div class="sfd-search"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" placeholder="Actions" /></div>
      <div class="sfd-items">${acts.map(a => `<label class="sfd-item"><input type="checkbox" value="${a}" /><span class="sfd-item-label">${a}</span><span class="sfd-item-count">0</span></label>`).join('')}</div>`;
  }

  const rect = chip.getBoundingClientRect();
  dd.style.left = rect.left + 'px';
  dd.style.top = (rect.bottom + 4) + 'px';
  document.body.appendChild(dd);
  chip.classList.add('active-filter');
  chip._filterDropdown = dd;

  const closeOnScroll = () => { dd.remove(); chip.classList.remove('active-filter'); chip._filterDropdown = null; };
  const mainContent = chip.closest('.main-content');
  if (mainContent) mainContent.addEventListener('scroll', closeOnScroll, { once: true });
}

export function applyStageFilters(candidates, stageKey) {
  const f = AppState.stageFilters[stageKey];
  if (!f) return candidates;
  let filtered = candidates;
  if (f.interviewStatus.length > 0) filtered = filtered.filter(c => f.interviewStatus.includes(c.interviewStatus));
  if (f.cheatProb.length > 0) filtered = filtered.filter(c => f.cheatProb.includes(c.cheatProbability));
  if (f.recruiterScreening.length > 0) filtered = filtered.filter(c => f.recruiterScreening.includes(c.recruiterScreening));
  if (f.scoreMin != null) filtered = filtered.filter(c => c.interviewScore != null && c.interviewScore >= f.scoreMin);
  if (f.scoreMax != null) filtered = filtered.filter(c => c.interviewScore != null && c.interviewScore <= f.scoreMax);
  return filtered;
}

export function hasActiveFilters(stageKey) {
  const f = AppState.stageFilters[stageKey];
  return f && (f.interviewStatus.length > 0 || f.cheatProb.length > 0 || f.recruiterScreening.length > 0 || f.scoreMin != null || f.scoreMax != null);
}