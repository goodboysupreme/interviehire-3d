// === Drag and Drop, Column Customization, Stage Panes and Agent Customization ===

let activeCardPlayerId = null;
let activeCardInterval = null;
let activeCardTime = 0; // ms
const cardDuration = 15000; // 15 seconds

export function initKanbanDragAndDrop() {
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

export function renderColumnsSelectorDropdowns() {
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