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
  const dropzone = document.getElementById('dropzone-resumes');
  if (dropzone) dropzone.style.display = 'none';
  const footer = dropzone ? dropzone.parentElement.querySelector('.sourcing-panel-footer') : null;
  if (footer) footer.style.display = 'none';
  countSpan.textContent = files.length;
  importBtn.disabled = true;

  uploadedFiles = [];
  filesList.innerHTML = '';

  appendTerminalLog(`<code>[${new Date().toLocaleTimeString()}] Aria:</code> Dropped ${files.length} candidate file(s). Initiating bulk text extraction...`);

  Array.from(files).forEach((file, idx) => {
    const item = {
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB',
      progress: 0,
      status: 'parsing',
      textContent: null,
      identity: null
    };
    uploadedFiles.push(item);

    const fileRow = document.createElement('div');
    fileRow.className = 'upload-file-item';
    fileRow.id = `file-item-${idx}`;
    fileRow.innerHTML = `
      <div class="upload-file-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
      </div>
      <div class="upload-file-info">
        <span class="upload-file-name">${item.name}</span>
        <div class="upload-file-size">${item.size}</div>
      </div>
      <div class="upload-file-progress-wrap">
        <div class="upload-file-progress-bar">
          <div class="upload-file-progress-inner" id="progress-inner-${idx}"></div>
        </div>
      </div>
      <span class="upload-file-status-badge parsing" id="status-badge-${idx}">Analyzing...</span>
    `;
    filesList.appendChild(fileRow);

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress = Math.min(92, currentProgress + Math.floor(Math.random() * 14 + 8));
      const progressInner = document.getElementById(`progress-inner-${idx}`);
      if (progressInner) {
        progressInner.style.setProperty('--progress', currentProgress / 100);
      }
    }, 150 + Math.random() * 150);

    extractTextFromResumeFile(file)
      .then(text => {
        const fallbackName = extractCandidateNameFromFilename(file.name);
        if (text && !isGarbageText(text)) {
          item.textContent = text;
          item.identity = extractResumeIdentity(text, fallbackName, file.name);
        } else {
          item.identity = extractResumeIdentity('', fallbackName, file.name);
        }
      })
      .catch(() => {
        item.identity = extractResumeIdentity('', extractCandidateNameFromFilename(file.name), file.name);
      })
      .finally(() => {
        clearInterval(interval);
        currentProgress = 100;

        const progressInner = document.getElementById(`progress-inner-${idx}`);
        if (progressInner) {
          progressInner.style.setProperty('--progress', 1);
        }

        const badge = document.getElementById(`status-badge-${idx}`);
        if (badge) {
          badge.textContent = item.textContent ? 'Extracted' : 'Name only';
          badge.className = 'upload-file-status-badge done';
        }

        const nameEl = fileRow.querySelector('.upload-file-name');
        if (nameEl && item.identity?.name) {
          nameEl.textContent = item.identity.name;
          nameEl.title = file.name;
        }

        appendTerminalLog(`<code>[${new Date().toLocaleTimeString()}] Aria:</code> ${item.textContent ? 'Extracted text and identity' : 'Used filename fallback'} for <strong>${file.name}</strong>${item.identity?.name ? ` as <strong>${item.identity.name}</strong>` : ''}.`);

        item.status = 'done';
        checkAllResumesDone();
      });
  });
}

export function checkAllResumesDone() {
  const allDone = uploadedFiles.every(f => f.status === 'done');
  if (allDone) {
    const importBtn = document.getElementById('btn-resumes-import');
    if (importBtn) importBtn.disabled = false;
    soundEngine.playChime([523.25, 659.25], 0.12, 0.08);
  }
}

export async function extractTextFromResumeFile(file) {
  const isTxt = /\.(txt|text)$/i.test(file.name);
  const isPdfOrDocx = /\.(pdf|docx?)$/i.test(file.name);

  if (isTxt) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result || '');
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  if (isPdfOrDocx) {
    const fd = new FormData();
    fd.append('file', file);
    const resp = await fetch('/api/parse-file', { method: 'POST', body: fd });
    if (!resp.ok) throw new Error('Parse failed');
    const data = await resp.json();
    return data.text || '';
  }

  return '';
}

export function importResumesCandidates() {
  if (uploadedFiles.length === 0) return;

  const activeJob = AppState.jobs.find(j => j.id === AppState.activeJobId);
  if (!activeJob) return;

  const importedCandIds = [];
  uploadedFiles.forEach(file => {
    const fallbackName = extractCandidateNameFromFilename(file.name);
    const identity = file.identity || extractResumeIdentity(file.textContent, fallbackName, file.name);
    const name = identity.name || fallbackName;
    const email = identity.email || createPlaceholderEmail(name);
    const phone = identity.phone || '';
    const candId = addCandidateToAppState(name, email, phone, activeJob, file.textContent);
    importedCandIds.push(candId);
  });

  soundEngine.playChime([392.00, 523.25, 659.25], 0.2, 0.08);
  showPremiumToast(`Imported \${uploadedFiles.length} candidate(s) — running AI analysis...`, "success");

  uploadedFiles = [];
  document.getElementById('resumes-preview-box').style.display = 'none';
  const fileRes = document.getElementById('input-file-resumes');
  if (fileRes) fileRes.value = '';
  const dropzone = document.getElementById('dropzone-resumes');
  if (dropzone) dropzone.style.display = '';
  const footer = dropzone ? dropzone.parentElement.querySelector('.sourcing-panel-footer') : null;
  if (footer) footer.style.display = '';

  recalculateJobPipelines();
  updateSummaryMetrics();
  renderAnalyticsTable();

  if (document.getElementById('jobs-board-container') && document.getElementById('jobs-board-container').style.display !== 'none') {
    renderKanbanBoard();
  } else {
    renderJobCards();
  }

  navigateToJobDetail(AppState.activeJobId);

  if (currentSourcingMode === 'analyse') {
    setTimeout(() => {
      runBulkResumeAnalysis(importedCandIds, activeJob);
    }, 600);
  }
}

export function extractCandidateNameFromFilename(filename) {
  let name = filename.replace(/\.[^/.]+$/, "");
  name = name.replace(/[_\-.]/g, " ");
  name = name.replace(/\b(resume|cv|hiring|job|developer|executive|profile|senior|junior|doc|pdf|en)\b/gi, "");
  name = name.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  if (!name) name = "Candidate " + Math.floor(Math.random() * 1000);
  return name;
}

export function extractResumeIdentity(text = '', fallbackName = '', filename = '') {
  const cleanText = normalizeResumeText(text);
  const email = extractResumeEmail(cleanText);
  const phone = extractResumePhone(cleanText);
  const linkedin = extractResumeLinkedIn(cleanText);
  const explicitName = extractExplicitResumeName(cleanText);
  const headerName = explicitName || extractHeaderResumeName(cleanText);
  const emailName = email ? nameFromEmail(email) : '';
  const filenameName = fallbackName || (filename ? extractCandidateNameFromFilename(filename) : '');
  const name = normalizeCandidateName(headerName || emailName || filenameName);

  return {
    name,
    email,
    phone,
    linkedin,
    source: headerName ? 'resume' : emailName ? 'email' : filename ? 'filename' : 'provided'
  };
}

export function normalizeResumeText(text = '') {
  return String(text)
    .replace(/\u0000/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\r\n?/g, '\n')
    .trim();
}

export function extractResumeEmail(text) {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : '';
}

export function extractResumePhone(text) {
  const candidates = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [];
  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 15) {
      return candidate.replace(/\s+/g, ' ').trim();
    }
  }
  return '';
}

export function extractResumeLinkedIn(text) {
  const match = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[^\s)]+/i);
  return match ? match[0].replace(/[.,;]+$/, '') : '';
}

export function extractExplicitResumeName(text) {
  const patterns = [
    /(?:^|\n)\s*(?:name|full name|candidate name)\s*[:-]\s*([A-Za-z][A-Za-z.' -]{2,80})/i,
    /(?:^|\n)\s*(?:candidate)\s*[:-]\s*([A-Za-z][A-Za-z.' -]{2,80})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const candidate = cleanNameLine(match[1]);
      if (isLikelyPersonName(candidate)) return candidate;
    }
  }
  return '';
}

export function extractHeaderResumeName(text) {
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 30);

  for (const line of lines) {
    const parts = line.split(/\s+[|]\s+|\s+-\s+|\s+--\s+/);
    for (const part of parts.slice(0, 2)) {
      const candidate = cleanNameLine(part);
      if (isLikelyPersonName(candidate)) return candidate;
    }
  }
  return '';
}

export function cleanNameLine(line = '') {
  return line
    .replace(/^[^A-Za-z]+|[^A-Za-z.' -]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeCandidateName(name = '') {
  const cleaned = cleanNameLine(name);
  if (!cleaned) return '';
  return cleaned.split(/\s+/).map(part => {
    if (/^[A-Z]{2,}$/.test(part)) {
      return part.charAt(0) + part.slice(1).toLowerCase();
    }
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join(' ');
}

export function isLikelyPersonName(name = '') {
  const cleaned = cleanNameLine(name);
  if (!cleaned || cleaned.length < 4 || cleaned.length > 60) return false;
  if (/[0-9@:/\\]/.test(cleaned)) return false;

  const lower = cleaned.toLowerCase();
  const blocked = [
    'resume', 'curriculum vitae', 'cv', 'profile', 'summary', 'objective',
    'education', 'experience', 'employment', 'skills', 'projects', 'certifications',
    'contact', 'email', 'phone', 'mobile', 'address', 'linkedin', 'github',
    'developer', 'engineer', 'manager', 'executive', 'consultant', 'analyst',
    'full stack', 'frontend', 'backend', 'software', 'tender', 'proposal'
  ];
  if (blocked.some(word => lower === word || lower.includes(`${word} `) || lower.includes(` ${word}`))) return false;

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;
  return words.every(word => /^[A-Za-z][A-Za-z.'-]{1,}$/.test(word));
}

export function nameFromEmail(email) {
  const local = email.split('@')[0] || '';
  const parts = local
    .replace(/[0-9]+/g, ' ')
    .split(/[._+-]+/)
    .map(part => part.trim())
    .filter(part => part.length > 1 && !['info', 'contact', 'mail', 'hello', 'admin', 'resume', 'cv'].includes(part.toLowerCase()));
  if (parts.length < 2) return '';
  return normalizeCandidateName(parts.slice(0, 3).join(' '));
}

export function createPlaceholderEmail(name) {
  const slug = normalizeCandidateName(name)
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
    .replace(/\s+/g, '.');
  return `${slug || 'candidate'}@resume.local`;
}