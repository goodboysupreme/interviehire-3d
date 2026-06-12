// === Manual Queue Intake Logic ===
export function addCandidateToManualQueue() {
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

export function removeCandidateFromQueue(index) {
  sourcingQueue.splice(index, 1);
  renderManualQueue();
  soundEngine.playClick();
}

export function renderManualQueue() {
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

export function importManualQueue() {
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