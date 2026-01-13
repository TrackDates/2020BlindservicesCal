/*
  2020 Measure — Leica DISTO X3 friendly measure form
  - Designed to work with Leica "keyboard mode" (Bluetooth HID): values are typed into focused inputs.
  - Stores drafts per job # in localStorage.
  - Submits a single JSON payload to Netlify Forms.
*/

(() => {
  /** @type {{job: any, windows: any[]}} */
  let model = {
    job: {
      job_number: '',
      client: '',
      date: '',
      measured_by: '',
      units: 'in',
      job_notes: ''
    },
    windows: []
  };

  const el = {
    auth: document.getElementById('auth'),
    loginGate: document.getElementById('loginGate'),
    btnLogin: document.getElementById('btnLogin'),
    app: document.getElementById('app'),
    userPill: document.getElementById('userPill'),
    form: document.getElementById('measureForm'),
    windows: document.getElementById('windows'),
    addWindow: document.getElementById('addWindow'),
    exportJson: document.getElementById('exportJson'),
    clearDraft: document.getElementById('clearDraft'),
    payload: document.getElementById('payload'),
    jobNumber: document.getElementById('jobNumber'),
    client: document.getElementById('client'),
    date: document.getElementById('date'),
    measuredBy: document.getElementById('measuredBy'),
    units: document.getElementById('units'),
    jobNotes: document.getElementById('jobNotes'),
    submitBtn: document.getElementById('submitBtn')
  };

  // ---------- helpers ----------
  const uid = () => Math.random().toString(36).slice(2, 10);

  /**
   * Parse a measurement coming from DISTO keyboard mode.
   * Supports:
   * - plain decimal: 52.125
   * - mm: 1234mm
   * - meters: 1.234m
   * - feet/inches: 5' 3 1/4" or 5'3.25"
   * Returns a number in requested units (in or mm), or null.
   */
  function parseMeasurement(raw, units) {
    if (!raw) return null;
    const s0 = String(raw).trim();
    if (!s0) return null;

    // Normalize comma decimals
    let s = s0.replace(/,/g, '.');

    // Feet/inches formats
    const hasFtIn = /['"]/g.test(s);
    if (hasFtIn) {
      // Example: 5' 3 1/4" or 5'3.25"
      const ftMatch = s.match(/(-?\d+(?:\.\d+)?)\s*'/);
      const inMatch = s.match(/'\s*([^\"]*)\"?/);
      const ft = ftMatch ? parseFloat(ftMatch[1]) : 0;

      let inches = 0;
      if (inMatch) {
        const part = inMatch[1].trim();
        if (part) {
          // Could be "3 1/4" or "3.25" or "1/4"
          const tokens = part.split(/\s+/).filter(Boolean);
          if (tokens.length === 1) {
            inches = parseMixedNumber(tokens[0]);
          } else if (tokens.length === 2) {
            inches = parseMixedNumber(tokens[0]) + parseMixedNumber(tokens[1]);
          } else {
            inches = parseFloat(tokens[0]) || 0;
          }
        }
      }
      const totalIn = ft * 12 + inches;
      return units === 'mm' ? totalIn * 25.4 : totalIn;
    }

    // Unit suffix handling
    const mmMatch = s.match(/(-?\d+(?:\.\d+)?)\s*mm\b/i);
    if (mmMatch) {
      const mm = parseFloat(mmMatch[1]);
      return units === 'mm' ? mm : mm / 25.4;
    }
    const mMatch = s.match(/(-?\d+(?:\.\d+)?)\s*m\b/i);
    if (mMatch) {
      const meters = parseFloat(mMatch[1]);
      const mm = meters * 1000;
      return units === 'mm' ? mm : mm / 25.4;
    }

    // Plain number (strip junk)
    const cleaned = s.replace(/[^0-9.\-\/ ]/g, '').trim();
    if (!cleaned) return null;

    // fraction like 1/4
    if (/^-?\d+\s*\/\s*\d+$/.test(cleaned)) {
      const [a, b] = cleaned.split('/').map(x => parseFloat(x.trim()));
      if (!b) return null;
      const val = a / b;
      return units === 'mm' ? val * 25.4 : val;
    }

    // mixed number like "3 1/4"
    if (/^-?\d+\s+\d+\s*\/\s*\d+$/.test(cleaned)) {
      const [wholeStr, fracStr] = cleaned.split(/\s+/, 2);
      const whole = parseFloat(wholeStr);
      const [a, b] = fracStr.split('/').map(x => parseFloat(x.trim()));
      if (!b) return null;
      const val = whole + a / b;
      return units === 'mm' ? val * 25.4 : val;
    }

    const val = parseFloat(cleaned);
    if (Number.isNaN(val)) return null;
    return val;
  }

  function parseMixedNumber(token) {
    const t = String(token).trim();
    if (!t) return 0;
    if (/^-?\d+(?:\.\d+)?$/.test(t)) return parseFloat(t);
    if (/^-?\d+\s*\/\s*\d+$/.test(t)) {
      const [a, b] = t.split('/').map(x => parseFloat(x.trim()));
      if (!b) return 0;
      return a / b;
    }
    if (/^-?\d+\s+\d+\s*\/\s*\d+$/.test(t)) {
      const parts = t.split(/\s+/);
      const whole = parseFloat(parts[0]);
      const [a, b] = parts[1].split('/').map(x => parseFloat(x.trim()));
      if (!b) return whole;
      return whole + a / b;
    }
    return parseFloat(t) || 0;
  }

  function draftKey() {
    const job = (el.jobNumber?.value || model.job.job_number || '').trim();
    return job ? `measureDraft:${job}` : 'measureDraft:__unsaved__';
  }

  function saveDraft() {
    try {
      localStorage.setItem(draftKey(), JSON.stringify(model));
    } catch (_) {
      // ignore
    }
  }

  function loadDraft(jobNumber) {
    if (!jobNumber) return false;
    try {
      const raw = localStorage.getItem(`measureDraft:${jobNumber}`);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return false;
      model = parsed;
      return true;
    } catch {
      return false;
    }
  }

  function clearDraft(jobNumber) {
    try {
      localStorage.removeItem(`measureDraft:${jobNumber}`);
    } catch (_) {}
  }

  // ---------- UI builders ----------
  function windowTemplate(w) {
    const div = document.createElement('section');
    div.className = 'window';
    div.dataset.wid = w.id;

    div.innerHTML = `
      <div class="window-header">
        <div>
          <div class="window-title">Window ${escapeHtml(w.label || '')}</div>
          <div class="muted small">Tip: click the first field, measure, and let the X3 <span class="kbd">Tab</span> to the next field.</div>
        </div>
        <div class="window-actions">
          <button type="button" class="btn btn-secondary" data-action="capture">Start capture</button>
          <button type="button" class="btn btn-danger" data-action="remove">Remove</button>
        </div>
      </div>

      <div class="grid-3">
        <label>Room / Area<input data-path="room" value="${escapeAttr(w.room)}" /></label>
        <label>Window label<input data-path="label" value="${escapeAttr(w.label)}" placeholder="e.g., Living Room - North" /></label>
        <label>Type
          <select data-path="type">
            <option value="">(optional)</option>
            <option value="roller" ${w.type==='roller'?'selected':''}>Roller / Screen</option>
            <option value="silhouette" ${w.type==='silhouette'?'selected':''}>Silhouette / Zebra</option>
            <option value="cell" ${w.type==='cell'?'selected':''}>Cellular</option>
            <option value="shutter" ${w.type==='shutter'?'selected':''}>Shutter</option>
            <option value="drapery" ${w.type==='drapery'?'selected':''}>Drapery</option>
          </select>
        </label>
      </div>

      <hr class="sep" />

      <div class="row-between">
        <div class="row">
          <span class="badge">Width: Top / Middle / Bottom</span>
          <span class="badge" data-out="minWidth">Min width: —</span>
        </div>
        <div class="row">
          <span class="badge">Height: Left / Center / Right</span>
          <span class="badge" data-out="minHeight">Min height: —</span>
        </div>
      </div>

      <div class="measure-grid" style="margin-top:10px">
        ${measureInput('Width (Top)', 'width.top', w.width.top)}
        ${measureInput('Width (Mid)', 'width.mid', w.width.mid)}
        ${measureInput('Width (Bottom)', 'width.bottom', w.width.bottom)}
        ${measureInput('Height (Left)', 'height.left', w.height.left)}
        ${measureInput('Height (Center)', 'height.center', w.height.center)}
        ${measureInput('Height (Right)', 'height.right', w.height.right)}
      </div>

      <hr class="sep" />

      <div class="grid-3">
        <label>Window depth<input data-path="depth" value="${escapeAttr(w.depth)}" placeholder="in / mm" /></label>
        <label>Control length<input data-path="control" value="${escapeAttr(w.control)}" placeholder="in / mm" /></label>
        <label>Split count
          <select data-path="splitCount">
            <option value="0" ${w.splitCount===0?'selected':''}>No split</option>
            <option value="1" ${w.splitCount===1?'selected':''}>1 split</option>
            <option value="2" ${w.splitCount===2?'selected':''}>2 splits</option>
            <option value="3" ${w.splitCount===3?'selected':''}>3 splits</option>
          </select>
        </label>
      </div>

      <div class="grid-3" data-splits style="margin-top:10px">
        ${splitInputs(w)}
      </div>

      <label style="margin-top:10px">Notes<textarea data-path="notes" rows="2">${escapeHtml(w.notes||'')}</textarea></label>
    `;

    // bind
    div.addEventListener('click', (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLElement)) return;
      const action = t.getAttribute('data-action');
      if (!action) return;
      if (action === 'remove') {
        removeWindow(w.id);
      } else if (action === 'capture') {
        const first = div.querySelector('input[data-path="width.top"]');
        if (first instanceof HTMLInputElement) first.focus();
      }
    });

    div.addEventListener('input', (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement)) return;
      const path = t.getAttribute('data-path');
      if (!path) return;
      setWindowField(w.id, path, t.value);

      // If split count changed, re-render this window section to show correct split fields
      if (path === 'splitCount') {
        setWindowField(w.id, path, Number(t.value || 0));
        render();
        return;
      }

      updateHighlights(w.id);
      saveDraft();
    });

    // When a measurement comes in, we can normalize on blur/enter
    div.addEventListener('blur', (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLInputElement)) return;
      const path = t.getAttribute('data-path');
      if (!path || !path.startsWith('width') && !path.startsWith('height') && !['depth','control'].includes(path)) return;

      const units = model.job.units || 'in';
      const val = parseMeasurement(t.value, units);
      if (val != null) {
        t.value = formatNumber(val);
        setWindowField(w.id, path, t.value);
        updateHighlights(w.id);
        saveDraft();
      }
    }, true);

    return div;
  }

  function measureInput(label, path, value) {
    return `
      <label data-wrap="${escapeAttr(path)}">${escapeHtml(label)}
        <input data-path="${escapeAttr(path)}" value="${escapeAttr(value)}" inputmode="decimal" placeholder="Click, measure, X3 sends value" />
      </label>
    `;
  }

  function splitInputs(w) {
    const count = Number(w.splitCount || 0);
    const out = [];
    for (let i = 0; i < 3; i++) {
      const show = i < count;
      const v = (w.splits && w.splits[i]) ? w.splits[i] : '';
      out.push(`
        <label class="${show ? '' : 'hidden'}">Split ${i + 1} location (from left)
          <input data-path="splits.${i}" value="${escapeAttr(v)}" inputmode="decimal" placeholder="in / mm" />
        </label>
      `);
    }
    return out.join('');
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/\n/g, ' ');
  }

  function formatNumber(n) {
    // Keep up to 3 decimals, trim trailing zeros
    const fixed = (Math.round(n * 1000) / 1000).toFixed(3);
    return fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  }

  // ---------- model ops ----------
  function newWindow() {
    return {
      id: uid(),
      room: '',
      label: String(model.windows.length + 1),
      type: '',
      width: { top: '', mid: '', bottom: '' },
      height: { left: '', center: '', right: '' },
      depth: '',
      control: '',
      splitCount: 0,
      splits: ['', '', ''],
      notes: ''
    };
  }

  function addWindow() {
    model.windows.push(newWindow());
    render();
    saveDraft();
  }

  function removeWindow(wid) {
    model.windows = model.windows.filter(w => w.id !== wid);
    // Re-number labels if labels are numeric only
    model.windows.forEach((w, idx) => {
      if (/^\d+$/.test(String(w.label || ''))) w.label = String(idx + 1);
    });
    render();
    saveDraft();
  }

  function setWindowField(wid, path, value) {
    const w = model.windows.find(x => x.id === wid);
    if (!w) return;

    const parts = path.split('.');
    let cur = w;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (!(k in cur)) cur[k] = {};
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function updateJobFromInputs() {
    model.job.job_number = (el.jobNumber?.value || '').trim();
    model.job.client = el.client?.value || '';
    model.job.date = el.date?.value || '';
    model.job.measured_by = el.measuredBy?.value || '';
    model.job.units = el.units?.value || 'in';
    model.job.job_notes = el.jobNotes?.value || '';
  }

  // ---------- highlights ----------
  function updateHighlights(wid) {
    const container = el.windows?.querySelector(`[data-wid="${wid}"]`);
    const w = model.windows.find(x => x.id === wid);
    if (!container || !w) return;

    // Clear old
    for (const lab of container.querySelectorAll('[data-wrap]')) {
      lab.classList.remove('min-highlight');
    }

    const units = model.job.units || 'in';

    const widthVals = [
      { path: 'width.top', v: parseMeasurement(w.width.top, units) },
      { path: 'width.mid', v: parseMeasurement(w.width.mid, units) },
      { path: 'width.bottom', v: parseMeasurement(w.width.bottom, units) },
    ].filter(x => x.v != null);

    const heightVals = [
      { path: 'height.left', v: parseMeasurement(w.height.left, units) },
      { path: 'height.center', v: parseMeasurement(w.height.center, units) },
      { path: 'height.right', v: parseMeasurement(w.height.right, units) },
    ].filter(x => x.v != null);

    const minW = widthVals.length ? widthVals.reduce((a, b) => (b.v < a.v ? b : a)) : null;
    const minH = heightVals.length ? heightVals.reduce((a, b) => (b.v < a.v ? b : a)) : null;

    if (minW) {
      const lab = container.querySelector(`[data-wrap="${minW.path}"]`);
      if (lab) lab.classList.add('min-highlight');
      const out = container.querySelector('[data-out="minWidth"]');
      if (out) out.textContent = `Min width: ${formatNumber(minW.v)} ${units}`;
    } else {
      const out = container.querySelector('[data-out="minWidth"]');
      if (out) out.textContent = 'Min width: —';
    }

    if (minH) {
      const lab = container.querySelector(`[data-wrap="${minH.path}"]`);
      if (lab) lab.classList.add('min-highlight');
      const out = container.querySelector('[data-out="minHeight"]');
      if (out) out.textContent = `Min height: ${formatNumber(minH.v)} ${units}`;
    } else {
      const out = container.querySelector('[data-out="minHeight"]');
      if (out) out.textContent = 'Min height: —';
    }
  }

  // ---------- render ----------
  function render() {
    // Job inputs
    if (el.jobNumber) el.jobNumber.value = model.job.job_number || '';
    if (el.client) el.client.value = model.job.client || '';
    if (el.date) el.date.value = model.job.date || '';
    if (el.measuredBy) el.measuredBy.value = model.job.measured_by || '';
    if (el.units) el.units.value = model.job.units || 'in';
    if (el.jobNotes) el.jobNotes.value = model.job.job_notes || '';

    // Windows
    if (el.windows) {
      el.windows.innerHTML = '';
      for (const w of model.windows) {
        el.windows.appendChild(windowTemplate(w));
      }
      for (const w of model.windows) updateHighlights(w.id);
    }
  }

  // ---------- export ----------
  function exportModelAsJson() {
    updateJobFromInputs();
    const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(model.job.job_number || 'measure').replace(/[^a-z0-9_-]/gi, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- auth ----------
  function renderAuth() {
    if (!window.netlifyIdentity) return;
    const user = window.netlifyIdentity.currentUser();

    // Top right auth area
    if (el.auth) {
      el.auth.innerHTML = '';
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary';
      if (user) {
        const span = document.createElement('span');
        span.className = 'pill';
        span.textContent = user.email;
        el.auth.appendChild(span);
        btn.textContent = 'Log out';
        btn.addEventListener('click', () => window.netlifyIdentity.logout());
        el.auth.appendChild(btn);
      } else {
        btn.textContent = 'Sign in';
        btn.addEventListener('click', () => window.netlifyIdentity.open('login'));
        el.auth.appendChild(btn);
      }
    }

    // Gate
    if (!user) {
      el.loginGate?.classList.remove('hidden');
      el.app?.classList.add('hidden');
      if (el.submitBtn) el.submitBtn.disabled = true;
      if (el.userPill) el.userPill.textContent = '';
      return;
    }

    el.loginGate?.classList.add('hidden');
    el.app?.classList.remove('hidden');
    if (el.submitBtn) el.submitBtn.disabled = false;

    model.job.measured_by = model.job.measured_by || user.email;
    if (el.measuredBy) el.measuredBy.value = model.job.measured_by;
    if (el.userPill) el.userPill.textContent = user.email;
  }

  // ---------- boot ----------
  function initDefaults() {
    if (!model.job.date) {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      model.job.date = `${yyyy}-${mm}-${dd}`;
    }
    if (!model.windows.length) model.windows.push(newWindow());
  }

  function bind() {
    el.btnLogin?.addEventListener('click', () => window.netlifyIdentity?.open('login'));

    // Job fields
    for (const inp of [el.jobNumber, el.client, el.date, el.measuredBy, el.units, el.jobNotes]) {
      inp?.addEventListener('input', () => {
        updateJobFromInputs();
        saveDraft();
      });
    }

    // When job number changes, try loading draft
    el.jobNumber?.addEventListener('change', () => {
      const j = (el.jobNumber?.value || '').trim();
      if (j && loadDraft(j)) {
        render();
      } else {
        updateJobFromInputs();
        saveDraft();
      }
    });

    el.addWindow?.addEventListener('click', addWindow);
    el.exportJson?.addEventListener('click', exportModelAsJson);
    el.clearDraft?.addEventListener('click', () => {
      const j = (el.jobNumber?.value || '').trim();
      if (j) clearDraft(j);
      // reset
      model = { job: { job_number: j, client: '', date: model.job.date, measured_by: model.job.measured_by, units: model.job.units, job_notes: '' }, windows: [newWindow()] };
      render();
    });

    el.form?.addEventListener('submit', (ev) => {
      const user = window.netlifyIdentity?.currentUser();
      if (!user) {
        ev.preventDefault();
        window.netlifyIdentity?.open('login');
        return;
      }
      if (!navigator.onLine) {
        ev.preventDefault();
        alert('You appear to be offline. Save the draft and submit when you have service.');
        return;
      }

      updateJobFromInputs();

      // Ensure at least one window
      if (!model.windows.length) model.windows.push(newWindow());

      // Add user email into measured_by if blank
      if (!model.job.measured_by) model.job.measured_by = user.email;
      if (el.measuredBy) el.measuredBy.value = model.job.measured_by;

      // Store one JSON payload for Netlify Forms
      if (el.payload) el.payload.value = JSON.stringify(model);

      // Clear draft after successful submit (best effort)
      setTimeout(() => {
        const j = (model.job.job_number || '').trim();
        if (j) clearDraft(j);
      }, 2500);
    });
  }

  window.addEventListener('load', () => {
    initDefaults();

    // Auto-load draft if job # already known (rare on first load)
    const j = (el.jobNumber?.value || '').trim();
    if (j) loadDraft(j);

    render();

    if (window.netlifyIdentity) {
      window.netlifyIdentity.on('init', () => {
        renderAuth();
      });
      window.netlifyIdentity.on('login', () => {
        renderAuth();
        window.netlifyIdentity.close();
        render();
      });
      window.netlifyIdentity.on('logout', () => {
        renderAuth();
      });
      window.netlifyIdentity.init();
    } else {
      // If Identity isn't enabled yet, still show the app
      el.loginGate?.classList.add('hidden');
      el.app?.classList.remove('hidden');
    }

    bind();
  });
})();
