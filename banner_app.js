/* ═══════════════════════════════════════════════════════════════
   BANNER GENERATOR — EDTECH Suite
   app.js — Core logic: DOCX parsing, Multi-API image search, Canvas compositing
   ═══════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  // ── Pexels API ──
  // ── Pexels API ──
  const DEFAULT_PEXELS_KEY = 'yi8dI44VNbsazfc9Z21JjOXKTCJpcBF7a0QYyc2A22h4shY7QPW8DnXn';
  let PEXELS_KEY = localStorage.getItem('edtech_pexels_token') || DEFAULT_PEXELS_KEY;
  const PEXELS_SEARCH = 'https://api.pexels.com/v1/search';

  // ── HuggingFace Inference API (100% GRATIS) ──
  // Obtén tu token gratis en: https://huggingface.co/settings/tokens
  let HF_TOKEN = localStorage.getItem('hf_token') || '';
  const HF_MODEL = 'black-forest-labs/FLUX.1-schnell';
  const HF_ENDPOINT = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;

  // ── Export Settings ──
  let EXPORT_FORMAT = localStorage.getItem('edtech_export_format') || 'image/jpeg';
  let EXPORT_QUALITY = parseInt(localStorage.getItem('edtech_export_quality') || '100', 10);

  // ── Canvas dimensions ──
  const DEFAULT_CANVAS_W = 1283;
  const DEFAULT_CANVAS_H = 250;

  function getCanvasW(b) { return b && b.width ? b.width : DEFAULT_CANVAS_W; }
  function getCanvasH(b) { return b && b.height ? b.height : DEFAULT_CANVAS_H; }

  // ── The 14 Banners ──
  const BANNER_DEFS = [
    { id: 'afi',      code: 'AFI',      name: 'Afianzamiento',      filename: 'banner_afi_s01',      searchTerm: '' },
    { id: 'aplic',    code: 'APLIC',    name: 'Aplicación',         filename: 'banner_aplic_s01',    searchTerm: '' },
    { id: 'cont',     code: 'CONT',     name: 'Contenido',          filename: 'banner_cont_s01',     searchTerm: '' },
    { id: 'plan',     code: 'PLAN',     name: 'Plan',               filename: 'banner_plan_s01',     searchTerm: '' },
    { id: 'foro',     code: 'FORO',     name: 'Foro',               filename: 'banner_foro_s01',     searchTerm: '' },
    { id: 'gam',      code: 'GAM',      name: 'Gamificación',       filename: 'banner_gam_s01',      searchTerm: '' },
    { id: 'h1',       code: 'H1',       name: 'Hito 1',             filename: 'banner_h1',           searchTerm: '' },
    { id: 'h2',       code: 'H2',       name: 'Hito 2',             filename: 'banner_h2',           searchTerm: '' },
    { id: 'h3',       code: 'H3',       name: 'Hito 3',             filename: 'banner_h3',           searchTerm: '' },
    { id: 'h4',       code: 'H4',       name: 'Hito 4',             filename: 'banner_h4',           searchTerm: '' },
    { id: 'h5',       code: 'H5',       name: 'Hito 5',             filename: 'banner_h5',           searchTerm: '' },
    { id: 'reflex',   code: 'REFLEX',   name: 'Pregunta Reflexiva', filename: 'banner_reflex_s01',   searchTerm: '' },
    { id: 'proyecto', code: 'PROYECTO', name: 'Proyecto',           filename: 'banner_proyecto_s01', searchTerm: '' },
    { id: 'com_docente', code: 'COM_DOCENTE', name: 'Comunidad Docente', filename: 'com_docente',    searchTerm: '', width: 463, height: 240, hideOverlay: true, hideOpacity: true },
  ];

  // ── State ──
  const state = {
    banners: BANNER_DEFS.map(b => ({
      ...b,
      bgImageUrl: null,      // selected image URL (large)
      bgImageThumb: null,    // for UI preview
      overlayDataUrl: null,  // user's uploaded PNG overlay
      pexelsResults: [],     // array of pexels images
      aiGeneratedUrl: null,  // DALL-E generated image (data URL)
      rendered: false,       // has canvas been rendered
      brightness: 40,        // background darkening (0=black, 100=full)
      overlayOpacity: 100,
      proposedKeywords: [],  // suggested search keywords before searching
      bgOffsetX: 0,          // background image X offset (drag position)
      bgOffsetY: 0,          // background image Y offset (drag position)
      bgScale: 100,          // background image scale (100 = cover fit)
      bgFlipX: false,        // horizontal flip
      bgColor: '#c3c3c3',    // canvas background color
      // AI prompt builder fields
      aiGender: 'mujer',
      aiAge: '30',
      aiContext: '',          // selected context from keywords
    })),
    activeBannerId: null,
    loadedDocs: [],
    subjectContext: '',      // e.g. "Contabilidad Gubernamental" — prefixed to all searches
    careerContext: '',       // e.g. "Contaduría Pública"
    docPrefix: '',           // e.g. "CGU-511" — extracted from loaded doc filename
    activeSource: 'pexels',  // 'pexels' or 'huggingface'
    isDragging: false,       // canvas drag state
    dragStartX: 0,
    dragStartY: 0,
  };

  // ── DOM refs ──
  const $  = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  const dom = {
    docxUpload:     $('#docx-upload'),
    loadedDocs:     $('#loaded-docs'),
    bannerList:     $('#banner-list'),
    canvasArea:     $('#canvas-area'),
    emptyState:     $('#empty-state'),
    canvasPreview:  $('#canvas-preview'),
    canvas:         $('#banner-canvas'),
    previewLabel:   $('#preview-label'),
    editorContent:  $('#editor-content'),
    searchAllBtn:   $('#search-all-btn'),
    downloadAllBtn: $('#download-all-btn'),
    renderAllBtn:   $('#render-all-btn'),
    btnDownloadSingle: $('#btn-download-single'),
    bgBrightness:   $('#bg-brightness'),
    bgBrightnessVal:$('#bg-brightness-val'),
    bgColorPicker:  $('#bg-color-picker'),
    bgColorHex:     $('#bg-color-hex'),
    overlayOpacity: $('#overlay-opacity'),
    overlayOpacityVal: $('#overlay-opacity-val'),
    loadingOverlay: $('#loading-overlay'),
    loadingText:    $('#loading-text'),
    toastContainer: $('#toast-container'),
    bboxOverlay:    $('#bbox-overlay'),
    canvasContainer: $('#canvas-container'),
  };

  const ctx = dom.canvas.getContext('2d');

  // ═══════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════

  function toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    dom.toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  function showLoading(text = 'Procesando...') {
    dom.loadingText.textContent = text;
    dom.loadingOverlay.classList.add('visible');
  }

  function hideLoading() {
    dom.loadingOverlay.classList.remove('visible');
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load: ${url}`));
      img.src = url;
    });
  }

  // ═══════════════════════════════════════
  // AI PROMPT BUILDER
  // ═══════════════════════════════════════

  function buildVisualScene(context) {
    const lc = context.toLowerCase();
    const scenes = {
      'derecho|legal|jurídic|legisla|norma|ley |leyes|penal|civil': {
        props: 'legal books, wooden gavel, law office, legal documents, bookshelf with law volumes',
        env: 'law firm office',
        activity: 'reviewing legal documents and case files'
      },
      'contab|financ|audit|tribut|impuest|fiscal|presupuest': {
        props: 'financial spreadsheets on screen, calculator, accounting ledgers, financial reports',
        env: 'corporate accounting office',
        activity: 'analyzing financial statements and reports'
      },
      'admin|gesti|organiz|empresa|gerencia|direcc': {
        props: 'laptop with charts, business reports, whiteboard with strategy diagrams',
        env: 'modern corporate office',
        activity: 'working on management strategies and business plans'
      },
      'market|publicidad|comunic|marca|brand': {
        props: 'creative mood board, marketing materials, laptop with analytics dashboard',
        env: 'creative agency workspace',
        activity: 'developing marketing campaign materials'
      },
      'medic|salud|enferm|hospit|clínic|farmac': {
        props: 'medical charts, stethoscope, hospital ward, medical equipment',
        env: 'hospital or medical clinic',
        activity: 'examining patient records and medical charts'
      },
      'ingeni|construc|arquitec|plano|diseño|obra': {
        props: 'blueprints, hard hat, construction plans, drafting tools, CAD software on screen',
        env: 'engineering firm or construction site office',
        activity: 'reviewing architectural blueprints and technical drawings'
      },
      'educa|pedagog|docen|enseñ|maestr|profesor|escuela|universi': {
        props: 'textbooks, whiteboard, classroom setting, educational materials',
        env: 'university classroom or lecture hall',
        activity: 'preparing lesson materials and lecture notes'
      },
      'psicolog|terapia|counsel': {
        props: 'therapy office, notepad, comfortable seating area, calming decor',
        env: 'psychotherapy office',
        activity: 'taking consultation notes during a therapy session'
      },
      'tecnolog|sistema|software|program|informátic|comput': {
        props: 'multiple monitors with code, modern tech office, development environment',
        env: 'technology company office',
        activity: 'writing code and developing software solutions'
      },
      'polític|gobierno|electoral|estado|públic': {
        props: 'government documents, official papers, institutional building interior',
        env: 'government office or public institution',
        activity: 'reviewing policy documents and government regulations'
      },
    };

    for (const [pattern, scene] of Object.entries(scenes)) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(lc)) return scene;
    }
    return {
      props: 'laptop, professional documents, organized desk',
      env: 'modern professional office',
      activity: 'working on professional documents and tasks'
    };
  }

  function buildFullPrompt(gender, age, context, career, shotType) {
    const scene = buildVisualScene(context + ' ' + career);

    // Hash the context to get deterministic but varied selections
    let hash = 0;
    for (let i = 0; i < context.length; i++) {
      hash = ((hash << 5) - hash) + context.charCodeAt(i);
      hash |= 0;
    }
    const pick = (arr) => arr[Math.abs(hash) % arr.length];

    // Varied angles and compositions
    const angles = ['three-quarter angle', 'slight profile view', 'frontal with slight tilt', 'over-the-shoulder perspective', 'looking up from task'];
    const moods = ['focused and confident', 'deeply concentrated', 'engaged and thoughtful', 'motivated and determined', 'curious and analytical'];
    const lightings = ['Natural office lighting', 'Soft window light from the left', 'Warm ambient interior lighting', 'Cool fluorescent overhead lighting', 'Golden hour light through large windows'];
    const lenses = ['35mm f/1.4', '50mm f/1.8', '85mm f/2', '24-70mm f/2.8 at 50mm', '35mm f/2'];
    
    const angle = pick(angles);
    const mood = pick(moods);
    const lighting = pick(lightings);
    const lens = pick(lenses);

    // Use actual context for a unique activity description
    const activityDesc = context && context !== 'professional environment' && context !== 'entorno profesional'
      ? `working on "${context}" related materials`
      : scene.activity;

    // Shot type
    let shotDesc;
    if (shotType === 'closeup') {
      shotDesc = `Professional close-up portrait of a latin ${gender}, ${age} years old, ${activityDesc} in a ${scene.env}. Tight close-up, chest-up framing, ${angle}, the person looks ${mood}. Background softly blurred with contextual elements visible.`;
    } else {
      shotDesc = `Professional realistic photograph of a latin ${gender}, ${age} years old, ${activityDesc} in a ${scene.env}. Medium shot, waist-up framing, ${angle}, the person is ${mood}.`;
    }

    return `${shotDesc} Context: ${context}. Visible props: ${scene.props}. ${lighting}, shallow depth of field, clean professional environment, institutional setting, balanced composition. Shot on Canon EOS R5, ${lens} lens, natural grain, real skin texture, no AI artifacts, no plastic skin, photojournalistic style, editorial quality, candid workplace photography`;
  }

  // ═══════════════════════════════════════
  // BANNER LIST — Left Sidebar
  // ═══════════════════════════════════════

  function renderBannerList() {
    dom.bannerList.innerHTML = state.banners.map(b => {
      const isActive = b.id === state.activeBannerId;
      const hasBg = !!b.bgImageUrl;
      const hasOverlay = !!b.overlayDataUrl;
      let statusIcon = '○';
      let statusClass = 'pending';
      if (hasBg && hasOverlay) { statusIcon = '●'; statusClass = 'ready'; }
      else if (hasBg || hasOverlay) { statusIcon = '◐'; statusClass = 'partial'; }

      return `
        <div class="banner-item ${isActive ? 'active' : ''}" data-id="${b.id}">
          <span class="banner-code" style="font-size:0.62rem;">›</span>
          <span class="banner-name" style="font-family:var(--font-mono); font-size:0.72rem;">${b.filename}</span>
          <span class="banner-status ${statusClass}" title="${hasBg ? 'Fondo ✓' : 'Sin fondo'}${hasOverlay ? ' | Overlay ✓' : ''}">${statusIcon}</span>
        </div>
      `;
    }).join('');

    // Bind clicks
    dom.bannerList.querySelectorAll('.banner-item').forEach(el => {
      el.addEventListener('click', () => selectBanner(el.dataset.id));
    });
  }

  function selectBanner(id) {
    state.activeBannerId = id;
    renderBannerList();
    renderEditor();
    renderCanvas();
    dom.emptyState.style.display = 'none';
    dom.canvasPreview.style.display = '';
    const b = getActiveBanner();
    // Editor UI updates
    const domBTitle = $('#editor-banner-title');
    if (domBTitle) domBTitle.textContent = `Editor: ${b.name} (${b.code})`;

    // Hide overlay options if banner configure it
    const overlaySection = document.querySelector('.overlay-upload-fixed');
    if (overlaySection) overlaySection.style.display = b.hideOverlay ? 'none' : 'block';
    
    const removeOverlayBtn = $('#btn-remove-overlay');
    if (removeOverlayBtn) removeOverlayBtn.style.display = b.hideOverlay ? 'none' : 'inline-block';

    dom.previewLabel.textContent = `${b.filename} — ${b.name}`;
    const previewDim = document.querySelector('.preview-dimensions');
    if (previewDim) previewDim.textContent = `${getCanvasW(b)} × ${getCanvasH(b)} px`;
    dom.bgBrightness.value = b.brightness;
    dom.bgBrightnessVal.textContent = b.brightness + '%';
    dom.bgColorPicker.value = b.bgColor || '#c3c3c3';
    dom.bgColorHex.value = b.bgColor || '#c3c3c3';
    dom.overlayOpacity.value = b.overlayOpacity;
    dom.overlayOpacityVal.textContent = b.overlayOpacity + '%';

    // Hide opacity slider group and its preceding separator if configured
    if (dom.overlayOpacity && dom.overlayOpacity.parentElement) {
      const opacityGroup = dom.overlayOpacity.parentElement;
      opacityGroup.style.display = b.hideOpacity ? 'none' : 'flex';
      if (opacityGroup.previousElementSibling && opacityGroup.previousElementSibling.classList.contains('separator')) {
        opacityGroup.previousElementSibling.style.display = b.hideOpacity ? 'none' : 'block';
      }
    }
  }

  function getActiveBanner() {
    return state.banners.find(b => b.id === state.activeBannerId);
  }

  // ═══════════════════════════════════════
  // EDITOR — Right Sidebar
  // ═══════════════════════════════════════

  function buildContextualQuery(term) {
    // Prepend the subject context to make searches more relevant
    if (state.subjectContext && term) {
      // Don't re-add if already present
      if (term.toLowerCase().includes(state.subjectContext.toLowerCase())) return term;
      return `${state.subjectContext} ${term}`;
    }
    return term;
  }

  function renderEditor() {
    const b = getActiveBanner();
    if (!b) { dom.editorContent.innerHTML = ""; return; }

    // Build keyword chips — deduplicate by normalizing case + punctuation
    const rawChips = b.proposedKeywords || [];
    const seen = new Set();
    const chips = rawChips.filter(kw => {
      const key = kw.toLowerCase().replace(/[^a-záéíóúñü0-9\s]/g, '').replace(/\s+/g, ' ').trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const keywordChips = chips.length
      ? chips.map(kw => '<span class="keyword-chip" data-kw="' + kw + '">' + kw + '</span>').join('')
      : '<span style="color:var(--text-muted); font-size:0.7rem;">Carga documentos para ver propuestas</span>';

    // Pexels results
    const currentResults = b.pexelsResults || [];

    // AI prompt
    const carrera = state.careerContext || state.subjectContext || 'la carrera';
    const aiCtx = b.aiContext || b.searchTerm || 'entorno profesional';
    const gender = (b.aiGender || 'mujer') === 'mujer' ? 'woman' : 'man';
    const shotType = b.aiShotType || 'medium';
    const aiPrompt = buildFullPrompt(gender, b.aiAge || '30', aiCtx, carrera, shotType);

    // Pre-build Pexels results HTML
    const pexelsResultsHtml = currentResults.length === 0
      ? '<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); font-size:0.75rem; padding:20px 0;">Escribe un concepto y pulsa Buscar</div>'
      : currentResults.map((p, i) => '<div class="pexels-thumb ' + (b.bgImageUrl === p._largeUrl ? "selected" : "") + '" data-idx="' + i + '" data-source="pexels"><img src="' + p._thumbUrl + '" alt="' + (p._alt || "") + '" loading="lazy"><span class="photographer"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position:relative; top:1px; margin-right:2px;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> ' + p._author + '</span></div>').join('');

    // Pre-build generated image HTML
    const generatedImageHtml = b.aiGeneratedUrl
      ? '<div style="border:1px solid var(--accent-border); border-radius:var(--radius); overflow:hidden; margin-bottom:10px; cursor:pointer;" id="ai-result-select">'
        + '<img src="' + b.aiGeneratedUrl + '" alt="AI Generated" style="width:100%; display:block;">'
        + '</div>'
        + '<div style="display:flex; gap:6px; margin-bottom:8px;">'
        + '<button class="btn" id="btn-download-ai-jpg" style="flex:1; justify-content:center; font-size:0.7rem; gap:4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> JPG</button>'
        + '<button class="btn" id="btn-download-ai-psd" style="flex:1; justify-content:center; font-size:0.7rem; gap:4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> PSD</button>'
        + '</div>'
        + '<button class="btn btn-primary" id="btn-regenerate-ai" style="width:100%; justify-content:center; padding:8px; font-size:0.75rem; gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg> Regenerar</button>'
      : '<div style="flex:1; display:flex; align-items:center; justify-content:center; border:2px dashed var(--border); border-radius:var(--radius); background:var(--bg-primary); min-height:120px;">'
        + '<div style="text-align:center; color:var(--text-muted);">'
        + '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.3; margin-bottom:8px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'
        + '<p style="font-size:0.72rem; margin:0;">Genera o busca una imagen</p>'
        + '<p style="font-size:0.62rem; margin:4px 0 0; opacity:0.6;">Aparecerá aquí</p>'
        + '</div></div>';

    dom.editorContent.innerHTML = `
      <!-- ═══════ ROW 1: CONTROLS (2 cols) ═══════ -->
      <div class="editor-grid-split" style="flex:0 0 auto; min-height:0;">
        <!-- COL 1: PEXELS SEARCH CONTROLS -->
        <div class="panel-column" style="overflow:visible;">
          <div class="panel-column-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Búsqueda Pexels
          </div>
          <div class="search-field" style="margin-bottom:8px;">
            <label style="display:flex; align-items:center; gap:6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              Carrera / Materia
            </label>
            <input type="text" id="subject-context-input" value="${state.subjectContext}" placeholder="Ej: Administración de Empresas...">
          </div>
          <div class="search-field" style="margin-bottom:8px; position:relative;">
            <label style="display:flex; align-items:center; gap:6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.9 1.2 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
              Palabras clave propuestas
              <button class="btn" id="btn-toggle-keywords" style="margin-left:auto; padding:2px 8px; font-size:0.6rem; gap:2px;" title="Ver lista">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                ${chips.length}
              </button>
            </label>
            <div id="keywords-dropdown" style="display:none; position:absolute; top:100%; left:0; right:0; z-index:100; max-height:180px; overflow-y:auto; background:var(--bg-primary); border:1px solid var(--accent-border); border-radius:var(--radius); margin-top:4px; box-shadow:0 4px 12px rgba(0,0,0,0.4);">
              ${chips.map(kw => '<div class="keyword-dropdown-item" data-kw="' + kw + '" style="padding:6px 10px; font-size:0.72rem; cursor:pointer; border-bottom:1px solid var(--border-light); color:var(--text-secondary); transition:background 0.15s;">' + kw + '</div>').join('')}
              ${chips.length === 0 ? '<div style="padding:8px 10px; font-size:0.68rem; color:var(--text-muted); text-align:center;">Carga documentos para ver propuestas</div>' : ''}
            </div>
          </div>
          <div class="search-field">
            <label>Concepto de búsqueda</label>
            <div class="input-group">
              <input type="text" id="search-term-input" value="${b.searchTerm}" placeholder="Ej: asesoramiento contable">
              <button class="btn btn-primary" id="btn-search-api" style="flex-shrink:0; gap:4px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Buscar
              </button>
            </div>
          </div>
          <div style="font-size:0.65rem; color:var(--accent); padding:2px 0 0; font-family:var(--font-mono); display:flex; align-items:center; gap:4px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Query: "${buildContextualQuery(b.searchTerm)}"
          </div>
        </div>

        <!-- COL 2: HUGGINGFACE AI CONTROLS -->
        <div class="panel-column" style="overflow:visible;">
          <div class="panel-column-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>
            HuggingFace AI (Generar con IA)
          </div>
          <div style="display:flex; gap:10px; margin-bottom:8px;">
            <div style="flex:1;">
              <label style="font-size:0.65rem; color:var(--text-muted); display:block; margin-bottom:4px;">Género</label>
              <select id="ai-gender" style="width:100%; padding:6px 8px; font-size:0.75rem; background:var(--bg-primary); border:1px solid var(--border); border-radius:var(--radius); color:var(--text-primary); outline:none;">
                <option value="mujer" ${b.aiGender === 'mujer' ? 'selected' : ''}>Mujer</option>
                <option value="hombre" ${b.aiGender === 'hombre' ? 'selected' : ''}>Hombre</option>
              </select>
            </div>
            <div style="flex:1;">
              <label style="font-size:0.65rem; color:var(--text-muted); display:block; margin-bottom:4px;">Edad</label>
              <input type="number" id="ai-age" value="${b.aiAge || '30'}" min="18" max="65" style="width:100%; padding:6px 8px; font-size:0.75rem; background:var(--bg-primary); border:1px solid var(--border); border-radius:var(--radius); color:var(--text-primary); outline:none;">
            </div>
          </div>
          <div style="margin-bottom:8px; position:relative;">
            <label style="font-size:0.65rem; color:var(--text-muted); display:block; margin-bottom:4px;">Contexto / Actividad</label>
            <div style="display:flex; gap:4px;">
              <input type="text" id="ai-context" value="${b.aiContext || b.searchTerm || ''}" placeholder="Ej: Administración Pública Boliviana" style="flex:1; padding:6px 8px; font-size:0.75rem; background:var(--bg-primary); border:1px solid var(--border); border-radius:var(--radius); color:var(--text-primary); outline:none;">
              <button class="btn" id="btn-context-suggestions" style="padding:4px 8px; font-size:0.65rem; gap:2px; white-space:nowrap;" title="Ver sugerencias">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            </div>
            <div id="context-suggestions-list" style="display:none; position:absolute; top:100%; left:0; right:0; z-index:100; max-height:160px; overflow-y:auto; background:var(--bg-primary); border:1px solid var(--accent-border); border-radius:var(--radius); margin-top:4px; box-shadow:0 4px 12px rgba(0,0,0,0.4);">
              ${(() => { const seen2 = new Set(); return (b.proposedKeywords || []).filter(kw => { const key2 = kw.toLowerCase().replace(/[^a-záéíóúñü0-9\s]/g, '').replace(/\s+/g, ' ').trim(); if (seen2.has(key2)) return false; seen2.add(key2); return true; }).map(kw => '<div class="context-suggestion-item" data-val="' + kw + '" style="padding:6px 10px; font-size:0.72rem; cursor:pointer; border-bottom:1px solid var(--border-light); color:var(--text-secondary); transition:background 0.15s;">' + kw + '</div>').join(''); })()}
              ${(b.proposedKeywords || []).length === 0 ? '<div style="padding:8px 10px; font-size:0.68rem; color:var(--text-muted); text-align:center;">Carga documentos para ver sugerencias</div>' : ''}
            </div>
          </div>
          <div style="display:flex; gap:6px; margin-bottom:8px;">
            <label style="font-size:0.65rem; color:var(--text-muted); display:flex; align-items:center; margin-right:4px; white-space:nowrap;">Tipo de toma:</label>
            <button class="btn ${(b.aiShotType || 'medium') === 'medium' ? 'btn-primary' : ''}" id="btn-shot-medium" style="flex:1; justify-content:center; font-size:0.7rem; padding:6px 8px; gap:4px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Medio cuerpo
            </button>
            <button class="btn ${b.aiShotType === 'closeup' ? 'btn-primary' : ''}" id="btn-shot-closeup" style="flex:1; justify-content:center; font-size:0.7rem; padding:6px 8px; gap:4px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12l4 4v10"/><path d="M6 3L2 7v10a2 2 0 0 0 2 2h12"/><circle cx="12" cy="13" r="3"/></svg>
              Closeup acción
            </button>
          </div>
          <div class="search-field">
            <label style="display:flex; align-items:center; gap:6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
              Vista previa del prompt
            </label>
            <div id="ai-prompt-preview" style="background:var(--bg-primary); border:1px solid var(--border); border-radius:var(--radius); padding:8px; font-size:0.65rem; font-family:var(--font-mono); color:var(--text-secondary); line-height:1.4; max-height:60px; overflow-y:auto; white-space:pre-wrap;">${aiPrompt}</div>
          </div>
        </div>
      </div>

      <!-- ═══════ ROW 2: RESULTS (3 cols) ═══════ -->
      <div class="editor-results-row">
        <!-- COL 1: PEXELS RESULTS -->
        <div class="panel-column results-col">
          <div style="font-size:0.7rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            Resultados Pexels
          </div>
          <div class="pexels-results" id="image-results">
            ${pexelsResultsHtml}
          </div>
        </div>

        <!-- COL 2: HUGGINGFACE GENERATE + CUSTOM -->
        <div class="panel-column results-col">
          <div style="display:flex; gap:6px; margin-bottom:10px;">
            <button class="btn btn-primary" id="btn-generate-ai" style="flex:3; justify-content:center; padding:10px; font-size:0.8rem; gap:6px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>
              Generar con IA
            </button>
            <button class="btn" id="btn-copy-prompt" style="flex:1; justify-content:center; padding:10px; font-size:0.75rem; gap:6px;" title="Copiar prompt">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copiar
            </button>
          </div>
          <div style="flex:1;">
            <div class="search-field" style="margin-bottom:8px;">
              <label style="display:flex; align-items:center; gap:6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                Fondo personalizado
              </label>
            </div>
            <input type="file" id="custom-bg-input" accept="image/*" style="display:none;">
            <div id="custom-bg-drop" style="border:2px dashed var(--border); border-radius:var(--radius); padding:16px; text-align:center; cursor:pointer; transition:border-color 0.2s; background:var(--bg-primary);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-muted); margin-bottom:6px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <p style="font-size:0.75rem; color:var(--text-primary); margin:0 0 4px; font-weight:500;">Haz clic o arrastra imagen</p>
              <p style="font-size:0.65rem; color:var(--text-muted); margin:0;">o usa <strong style="color:var(--accent);">Ctrl+V</strong></p>
            </div>
          </div>
        </div>

        <!-- COL 3: GENERATED IMAGE PREVIEW -->
        <div class="panel-column results-col">
          <div style="font-size:0.7rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Imagen generada
          </div>
          ${generatedImageHtml}
        </div>
      </div>

      <!-- Position Controls (inline, compact) -->
      <div style="display:flex; gap:12px; align-items:center; padding:10px 16px; background:var(--bg-tertiary); border:1px solid var(--border); border-radius:var(--radius); margin-top:8px;">
        <span style="font-size:0.65rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; white-space:nowrap; letter-spacing:0.5px;">Fondo:</span>
        <div style="display:flex; align-items:center; gap:4px; flex:1;">
          <label style="font-size:0.68rem; color:var(--text-secondary); white-space:nowrap;">Escala</label>
          <input type="range" id="editor-bg-scale" min="50" max="200" value="${b.bgScale || 100}" style="flex:1; accent-color:var(--accent);">
          <span class="ctrl-value" id="editor-bg-scale-val" style="font-size:0.65rem; font-family:var(--font-mono); color:var(--text-muted); width:35px; text-align:right;">${b.bgScale || 100}%</span>
        </div>
        <div style="width:1px; height:16px; background:var(--border);"></div>
        <div style="display:flex; align-items:center; gap:4px; flex:1;">
          <label style="font-size:0.68rem; color:var(--text-secondary); white-space:nowrap;">X</label>
          <input type="range" id="editor-bg-offset-x" min="-500" max="500" value="${Math.round(b.bgOffsetX || 0)}" style="flex:1; accent-color:var(--accent);">
          <span class="ctrl-value" id="editor-bg-offset-x-val" style="font-size:0.65rem; font-family:var(--font-mono); color:var(--text-muted); width:35px; text-align:right;">${Math.round(b.bgOffsetX || 0)}</span>
        </div>
        <div style="width:1px; height:16px; background:var(--border);"></div>
        <div style="display:flex; align-items:center; gap:4px; flex:1;">
          <label style="font-size:0.68rem; color:var(--text-secondary); white-space:nowrap;">Y</label>
          <input type="range" id="editor-bg-offset-y" min="-500" max="500" value="${Math.round(b.bgOffsetY || 0)}" style="flex:1; accent-color:var(--accent);">
          <span class="ctrl-value" id="editor-bg-offset-y-val" style="font-size:0.65rem; font-family:var(--font-mono); color:var(--text-muted); width:35px; text-align:right;">${Math.round(b.bgOffsetY || 0)}</span>
        </div>
        <div style="width:1px; height:16px; background:var(--border);"></div>
        <button class="btn" id="btn-flip-x" style="font-size:0.65rem; padding:4px 10px; gap:4px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
          Flip
        </button>
        <button class="btn" id="btn-reset-pos" style="font-size:0.65rem; padding:4px 10px; gap:4px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          Reset
        </button>
      </div>
    `;

    // ── Bind events ──
    const searchInput = $('#search-term-input');
    const btnSearch = $('#btn-search-api');
    const subjectInput = $('#subject-context-input');

    // Subject context sync
    if (subjectInput) {
      subjectInput.addEventListener('change', () => {
        state.subjectContext = subjectInput.value.trim();
        renderEditor(); // refresh query preview
      });
      subjectInput.addEventListener('input', () => {
        state.subjectContext = subjectInput.value.trim();
        // Update query preview live
        const preview = dom.editorContent.querySelector('[style*="font-family:var(--font-mono)"]');
        if (preview) preview.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position:relative; top:1px; margin-right:4px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Query: "${buildContextualQuery(b.searchTerm)}"`;
      });
    }

    // Keyword chips click -> fill search / AI context
    document.querySelectorAll('.keyword-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        b.searchTerm = chip.dataset.kw;
        b.aiContext = chip.dataset.kw; // also set AI context
        if (searchInput) searchInput.value = b.searchTerm;
        renderEditor(); // refresh prompt preview and queries
      });
    });

    if (searchInput) {
      searchInput.addEventListener('change', () => {
        b.searchTerm = searchInput.value.trim();
      });
      searchInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && btnSearch) { btnSearch.click(); }
      });
      searchInput.addEventListener('input', () => {
        b.searchTerm = searchInput.value.trim();
        const preview = dom.editorContent.querySelector('[style*="font-family:var(--font-mono)"]');
        if (preview) preview.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position:relative; top:1px; margin-right:4px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Query: "${buildContextualQuery(b.searchTerm)}"`;
      });
    }

    if (btnSearch) {
      btnSearch.addEventListener('click', async () => {
        b.searchTerm = searchInput.value.trim();
        if (!b.searchTerm) { toast('Ingresa un concepto de búsqueda', 'error'); return; }
        await searchPexels(b);
        renderEditor();
      });
    }



    // AI prompt builder fields
    const aiGender = $('#ai-gender');
    const aiAge = $('#ai-age');
    const aiContext = $('#ai-context');
    const btnGenerate = $('#btn-generate-ai');

    if (aiGender) {
      aiGender.addEventListener('change', () => {
        b.aiGender = aiGender.value;
        renderEditor(); // refresh prompt preview
      });
    }
    if (aiAge) {
      aiAge.addEventListener('change', () => {
        b.aiAge = aiAge.value;
        renderEditor();
      });
    }
    if (aiContext) {
      aiContext.addEventListener('input', () => {
        b.aiContext = aiContext.value;
        // Update prompt preview in real-time
        const previewEl = $('#ai-prompt-preview');
        if (previewEl) {
          const carrera = state.careerContext || state.subjectContext || 'la carrera';
          const gender = (b.aiGender || 'mujer') === 'mujer' ? 'woman' : 'man';
          const shotType = b.aiShotType || 'medium';
          previewEl.textContent = buildFullPrompt(gender, b.aiAge || '30', b.aiContext, carrera, shotType);
        }
      });
      aiContext.addEventListener('change', () => {
        b.aiContext = aiContext.value;
        renderEditor();
      });
    }

    // Context suggestions dropdown
    const btnSuggestions = $('#btn-context-suggestions');
    const suggestionsList = $('#context-suggestions-list');
    if (btnSuggestions && suggestionsList) {
      btnSuggestions.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = suggestionsList.style.display !== 'none';
        suggestionsList.style.display = isOpen ? 'none' : 'block';
      });
      suggestionsList.querySelectorAll('.context-suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
          b.aiContext = item.dataset.val;
          if (aiContext) aiContext.value = item.dataset.val;
          suggestionsList.style.display = 'none';
          renderEditor();
        });
      });
      // Close dropdown on outside click (persistent, not once)
      document.addEventListener('click', (e) => {
        if (!btnSuggestions.contains(e.target) && !suggestionsList.contains(e.target)) {
          suggestionsList.style.display = 'none';
        }
      });
    }

    // Keywords dropdown toggle + click to set searchTerm
    const btnToggleKw = $('#btn-toggle-keywords');
    const kwDropdown = $('#keywords-dropdown');
    if (btnToggleKw && kwDropdown) {
      btnToggleKw.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = kwDropdown.style.display !== 'none';
        kwDropdown.style.display = isOpen ? 'none' : 'block';
      });
      kwDropdown.querySelectorAll('.keyword-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          const val = item.dataset.kw;
          b.searchTerm = val;
          kwDropdown.style.display = 'none';
          renderEditor();
        });
      });
      document.addEventListener('click', (e) => {
        if (!btnToggleKw.contains(e.target) && !kwDropdown.contains(e.target)) {
          kwDropdown.style.display = 'none';
        }
      });
    }
    // Shot type buttons
    const btnShotMedium = $('#btn-shot-medium');
    const btnShotCloseup = $('#btn-shot-closeup');
    if (btnShotMedium) {
      btnShotMedium.addEventListener('click', () => {
        b.aiShotType = 'medium';
        renderEditor();
      });
    }
    if (btnShotCloseup) {
      btnShotCloseup.addEventListener('click', () => {
        b.aiShotType = 'closeup';
        renderEditor();
      });
    }
    if (btnGenerate) {
      btnGenerate.addEventListener('click', () => generateHuggingFaceImage(b));
    }

    // AI generated image — click to use as background
    const aiResultSelect = $('#ai-result-select');
    if (aiResultSelect) {
      aiResultSelect.addEventListener('click', () => {
        if (b.aiGeneratedUrl) {
          b.bgImageUrl = b.aiGeneratedUrl;
          b.bgImageThumb = b.aiGeneratedUrl;
          renderCanvas();
          renderBannerList();
          toast('Imagen IA aplicada como fondo', 'success');
        }
      });
    }

    // AI JPG download
    const btnJpg = $('#btn-download-ai-jpg');
    if (btnJpg) {
      btnJpg.addEventListener('click', () => downloadAiJpg(b));
    }

    // AI PSD download
    const btnPsd = $('#btn-download-ai-psd');
    if (btnPsd) {
      btnPsd.addEventListener('click', () => downloadAiPsd(b));
    }

    // Regenerate AI image
    const btnRegen = $('#btn-regenerate-ai');
    if (btnRegen) {
      btnRegen.addEventListener('click', () => generateHuggingFaceImage(b));
    }

    // Copy prompt button
    const btnCopy = $('#btn-copy-prompt');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        const previewEl = $('#ai-prompt-preview');
        const text = previewEl ? previewEl.textContent : '';
        navigator.clipboard.writeText(text).then(() => {
          toast('Prompt copiado al portapapeles', 'success');
        }).catch(() => {
          // Fallback
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          toast('Prompt copiado', 'success');
        });
      });
    }

    // Custom image upload (file input + click zone)
    const customInput = $('#custom-bg-input');
    const customDrop = $('#custom-bg-drop');
    if (customDrop && customInput) {
      customDrop.addEventListener('click', () => customInput.click());
      customDrop.addEventListener('dragover', e => { e.preventDefault(); customDrop.style.borderColor = 'var(--accent)'; });
      customDrop.addEventListener('dragleave', () => { customDrop.style.borderColor = 'var(--border)'; });
      customDrop.addEventListener('drop', e => {
        e.preventDefault();
        customDrop.style.borderColor = 'var(--border)';
        if (e.dataTransfer.files.length) applyCustomBgFile(e.dataTransfer.files[0], b);
      });
      customInput.addEventListener('change', () => {
        if (customInput.files.length) applyCustomBgFile(customInput.files[0], b);
        customInput.value = '';
      });
    }

    // Clipboard paste (Ctrl+V anywhere in editor)
    dom.editorContent.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) applyCustomBgFile(blob, b);
          return;
        }
      }
    });

    // Pexels image results click
    document.querySelectorAll('#image-results .pexels-thumb').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx);
        const photo = b.pexelsResults[idx];
        if (photo) {
          b.bgImageUrl = photo._largeUrl;
          b.bgImageThumb = photo._thumbUrl;
        }
        renderEditor();
        renderCanvas();
        renderBannerList();
      });
    });



    // Editor brightness/opacity sliders
    const edBright = $('#editor-brightness');
    const edBrightVal = $('#editor-brightness-val');
    const edOpacity = $('#editor-overlay-opacity');
    const edOpacityVal = $('#editor-overlay-opacity-val');
    const edScale = $('#editor-bg-scale');
    const edScaleVal = $('#editor-bg-scale-val');
    const edOffX = $('#editor-bg-offset-x');
    const edOffXVal = $('#editor-bg-offset-x-val');
    const edOffY = $('#editor-bg-offset-y');
    const edOffYVal = $('#editor-bg-offset-y-val');

    if (edScale) {
      edScale.addEventListener('input', () => {
        b.bgScale = parseInt(edScale.value);
        edScaleVal.textContent = b.bgScale + '%';
        renderCanvas();
      });
    }
    if (edOffX) {
      edOffX.addEventListener('input', () => {
        b.bgOffsetX = parseInt(edOffX.value);
        edOffXVal.textContent = b.bgOffsetX;
        renderCanvas();
      });
    }
    if (edOffY) {
      edOffY.addEventListener('input', () => {
        b.bgOffsetY = parseInt(edOffY.value);
        edOffYVal.textContent = b.bgOffsetY;
        renderCanvas();
      });
    }
    if (edBright) {
      edBright.addEventListener('input', () => {
        b.brightness = parseInt(edBright.value);
        edBrightVal.textContent = b.brightness + '%';
        dom.bgBrightness.value = b.brightness;
        dom.bgBrightnessVal.textContent = b.brightness + '%';
        renderCanvas();
      });
    }
    
    if (edOpacity) {
      // Hide opacity slider if configured
      const parentForm = edOpacity.parentElement || edOpacity.parentNode;
      if (parentForm) parentForm.style.display = b.hideOpacity ? 'none' : 'flex';
      
      edOpacity.addEventListener('input', () => {
        b.overlayOpacity = parseInt(edOpacity.value);
        edOpacityVal.textContent = b.overlayOpacity + '%';
        dom.overlayOpacity.value = b.overlayOpacity;
        dom.overlayOpacityVal.textContent = b.overlayOpacity + '%';
        renderCanvas();
      });
    }

    // Background color picker
    const edBgColor = $('#editor-bg-color');
    const edBgColorHex = $('#editor-bg-color-hex');
    if (edBgColor) {
      edBgColor.addEventListener('input', () => {
        b.bgColor = edBgColor.value;
        if (edBgColorHex) edBgColorHex.value = edBgColor.value;
        renderCanvas();
      });
    }
    if (edBgColorHex) {
      edBgColorHex.addEventListener('change', () => {
        let val = edBgColorHex.value.trim();
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          b.bgColor = val;
          if (edBgColor) edBgColor.value = val;
          renderCanvas();
        } else {
          toast('Formato hexadecimal inválido (Ej: #c3c3c3)', 'error');
          edBgColorHex.value = b.bgColor || '#c3c3c3';
        }
      });
    }

    // Flip horizontal
    const btnFlipX = $('#btn-flip-x');
    if (btnFlipX) {
      btnFlipX.addEventListener('click', () => {
        b.bgFlipX = !b.bgFlipX;
        renderCanvas();
        toast(b.bgFlipX ? 'Imagen volteada' : 'Imagen normal', 'info');
      });
    }

    // Reset background position + scale + flip
    const btnResetPos = $('#btn-reset-pos');
    if (btnResetPos) {
      btnResetPos.addEventListener('click', () => {
        b.bgOffsetX = 0;
        b.bgOffsetY = 0;
        b.bgScale = 100;
        b.bgFlipX = false;
        renderCanvas();
        renderEditor();
        toast('Posición, escala y flip reiniciados', 'info');
      });
    }
  }

  function handleOverlayFile(file) {
    if (!file.type.startsWith('image/png')) {
      toast('Solo se aceptan archivos PNG', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      // Apply overlay to ALL banners
      state.banners.forEach(b => { b.overlayDataUrl = reader.result; });
      renderEditor();
      renderCanvas();
      renderBannerList();
      // Show preview in sidebar
      const preview = $('#overlay-preview');
      if (preview) {
        preview.classList.add('visible');
        preview.querySelector('img')?.remove();
        const img = document.createElement('img');
        img.src = reader.result;
        img.alt = 'Overlay';
        preview.prepend(img);
      }
      toast(`Overlay PNG aplicado a los ${state.banners.length} banners`, 'success');
    };
    reader.readAsDataURL(file);
  }

  // Apply a custom image file as the active banner's background
  function applyCustomBgFile(file, banner) {
    if (!file.type.startsWith('image/')) {
      toast('Solo se aceptan archivos de imagen', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      banner.bgImageUrl = reader.result;
      banner.bgImageThumb = reader.result;
      renderEditor();
      renderCanvas();
      renderBannerList();
      toast('Imagen personalizada aplicada como fondo', 'success');
    };
    reader.readAsDataURL(file);
  }

  // ═══════════════════════════════════════
  // PEXELS API
  // ═══════════════════════════════════════

  async function searchPexels(banner) {
    showLoading('Buscando en Pexels...');
    try {
      const query = buildContextualQuery(banner.searchTerm);
      const url = `${PEXELS_SEARCH}?query=${encodeURIComponent(query)}&orientation=landscape&per_page=12&size=large`;
      const res = await fetch(url, {
        headers: { 'Authorization': state.pexelsApiKey }
      });
      if (!res.ok) throw new Error(`Pexels API error: ${res.status}`);
      const data = await res.json();
      // Normalize to unified format
      banner.pexelsResults = (data.photos || []).map(p => ({
        ...p,
        _thumbUrl: p.src.medium,
        _largeUrl: p.src.large2x,
        _author: p.photographer,
        _alt: p.alt || '',
      }));
      if (banner.pexelsResults.length === 0) {
        toast('No se encontraron imágenes (Pexels)', 'error');
      } else {
        toast(`${banner.pexelsResults.length} imágenes (Pexels)`, 'success');
        if (!banner.bgImageUrl) {
          banner.bgImageUrl = banner.pexelsResults[0]._largeUrl;
          banner.bgImageThumb = banner.pexelsResults[0]._thumbUrl;
        }
      }
    } catch (err) {
      console.error(err);
      toast('Error Pexels: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  }

  // ═══════════════════════════════════════
  // HUGGINGFACE AI IMAGE GENERATION (100% GRATIS)
  // ═══════════════════════════════════════

  async function generateHuggingFaceImage(banner) {
    // Re-fetch the banner from state to ensure we have the latest values
    const freshBanner = state.banners.find(b => b.id === banner.id) || banner;
    banner = freshBanner;

    // Auto-read token from input if available
    const tokenInput = $('#hf-token-input');
    if (tokenInput && tokenInput.value.trim()) {
      HF_TOKEN = tokenInput.value.trim();
      localStorage.setItem('hf_token', HF_TOKEN);
    }
    if (!HF_TOKEN) {
      toast('Ingresa tu token de HuggingFace primero', 'error');
      return;
    }

    const carrera = state.careerContext || state.subjectContext || 'professional career';
    const ctx = banner.aiContext || banner.searchTerm || 'professional environment';
    const gender = banner.aiGender === 'mujer' ? 'woman' : 'man';
    const age = banner.aiAge || '30';
    const shotType = banner.aiShotType || 'medium';

    const prompt = buildFullPrompt(gender, age, ctx, carrera, shotType);

    showLoading('Generando imagen con FLUX.1...');
    dom.loadingText.textContent = 'Esto puede tomar 20-60 segundos...';

    try {
      const requestBody = {
        inputs: prompt,
        parameters: {
          width: 1344,
          height: 768,
          num_inference_steps: 4,
        },
      };

      const res = await fetch(HF_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        // HuggingFace returns JSON error for some cases
        let errMsg = `API error: ${res.status}`;
        try {
          const errData = await res.json();
          // Model is loading — retry after estimated time
          if (errData.estimated_time) {
            const wait = Math.ceil(errData.estimated_time);
            dom.loadingText.textContent = `Modelo cargando... espera ~${wait}s`;
            await new Promise(r => setTimeout(r, (wait + 5) * 1000));
            // Retry once
            const res2 = await fetch(HF_ENDPOINT, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${HF_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            });
            if (!res2.ok) throw new Error(`API error en reintento: ${res2.status}`);
            const blob2 = await res2.blob();
            banner.aiGeneratedUrl = await blobToDataUrl(blob2);
          } else {
            throw new Error(errData.error || errMsg);
          }
        } catch (parseErr) {
          if (parseErr.message.includes('API error')) throw parseErr;
          throw new Error(errMsg);
        }
      } else {
        // Success — response is a binary image
        const blob = await res.blob();
        banner.aiGeneratedUrl = await blobToDataUrl(blob);
      }

      // Auto-apply as background
      banner.bgImageUrl = banner.aiGeneratedUrl;
      banner.bgImageThumb = banner.aiGeneratedUrl;

      toast('Imagen generada con éxito (HuggingFace)', 'success');
      renderEditor();
      renderCanvas();
      renderBannerList();
    } catch (err) {
      console.error('HuggingFace error:', err);
      toast('Error HuggingFace: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  }

  // Helper: convert Blob to data URL
  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // ═══════════════════════════════════════
  // AI IMAGE EXPORTS (JPG + PSD)
  // ═══════════════════════════════════════

  function downloadAiJpg(banner) {
    if (!banner.aiGeneratedUrl) { toast('No hay imagen generada', 'error'); return; }

    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const cx = c.getContext('2d');
      cx.drawImage(img, 0, 0);
      const link = document.createElement('a');
      const prefix = state.docPrefix ? state.docPrefix + '_' : '';
      link.download = `${prefix}${banner.filename}_ai.jpg`;
      link.href = c.toDataURL('image/jpeg', 0.95);
      link.click();
      toast('JPG descargado', 'success');
    };
    img.src = banner.aiGeneratedUrl;
  }

  async function createPsdBuffer(banner, width, height, aiImg) {
    // Create canvas for AI image layer
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = width;
    bgCanvas.height = height;
    const bgCtx = bgCanvas.getContext('2d');
    bgCtx.drawImage(aiImg, 0, 0);

    // Build PSD structure
    const psd = {
      width: width,
      height: height,
      children: [
        {
          name: 'Fondo IA',
          canvas: bgCanvas,
          left: 0,
          top: 0,
          opacity: 1,
          blendMode: 'normal',
        },
      ],
    };

    // Add overlay layer if exists
    if (banner.overlayDataUrl) {
      const overlayImg = await loadImage(banner.overlayDataUrl);
      const ovCanvas = document.createElement('canvas');
      ovCanvas.width = width;
      ovCanvas.height = height;
      const ovCtx = ovCanvas.getContext('2d');
      // Scale overlay to fit
      const scale = Math.max(width / overlayImg.width, height / overlayImg.height);
      const w = overlayImg.width * scale;
      const h = overlayImg.height * scale;
      ovCtx.drawImage(overlayImg, (width - w) / 2, (height - h) / 2, w, h);

      psd.children.push({
        name: 'Overlay PNG',
        canvas: ovCanvas,
        left: 0,
        top: 0,
        opacity: (banner.overlayOpacity || 100) / 100,
        blendMode: 'normal',
      });
    }

    // Generate PSD buffer using ag-psd
    const psdLib = window.agPsd;
    if (!psdLib || !psdLib.writePsd) {
      throw new Error('Librería ag-psd no cargada. Verifica tu conexión a internet.');
    }

    return psdLib.writePsd(psd);
  }

  async function downloadAiPsd(banner) {
    if (!banner.aiGeneratedUrl) { toast('No hay imagen generada', 'error'); return; }

    showLoading('Creando archivo PSD con capas...');

    try {
      // Load AI image
      const aiImg = await loadImage(banner.aiGeneratedUrl);
      const width = aiImg.width;
      const height = aiImg.height;

      const buffer = await createPsdBuffer(banner, width, height, aiImg);
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const prefix = state.docPrefix ? state.docPrefix + '_' : '';
      link.download = `${prefix}${banner.filename}_ai.psd`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      toast('PSD con capas descargado', 'success');
    } catch (err) {
      console.error('PSD export error:', err);
      toast('Error creando PSD: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  }

  // ═══════════════════════════════════════
  // CANVAS RENDERING
  // ═══════════════════════════════════════

  async function renderCanvas() {
    const b = getActiveBanner();
    if (!b) return;

    const CANVAS_W = getCanvasW(b);
    const CANVAS_H = getCanvasH(b);

    dom.canvas.width = CANVAS_W;
    dom.canvas.height = CANVAS_H;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Background: custom color
    ctx.fillStyle = b.bgColor || '#c3c3c3';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Draw background image with offset + scale (bounding box)
    if (b.bgImageUrl) {
      try {
        const img = await loadImage(b.bgImageUrl);
        // Cover fit × user scale
        const baseScale = Math.max(CANVAS_W / img.width, CANVAS_H / img.height);
        const userScale = (b.bgScale || 100) / 100;
        const scale = baseScale * userScale;
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (CANVAS_W - w) / 2 + (b.bgOffsetX || 0);
        const y = (CANVAS_H - h) / 2 + (b.bgOffsetY || 0);

        // Apply image opacity (lower = more bg color showing through)
        ctx.globalAlpha = (b.brightness || 40) / 100;
        if (b.bgFlipX) {
          ctx.save();
          ctx.scale(-1, 1);
          ctx.drawImage(img, -x - w, y, w, h);
          ctx.restore();
        } else {
          ctx.drawImage(img, x, y, w, h);
        }
        ctx.globalAlpha = 1;
      } catch (err) {
        console.warn('Could not load bg image:', err);
        // Draw placeholder
        ctx.fillStyle = '#2a2a3e';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = '#555';
        ctx.font = '16px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Error cargando imagen de fondo', CANVAS_W / 2, CANVAS_H / 2);
      }
    } else {
      // No bg image — solid bg color
      ctx.fillStyle = b.bgColor || '#c3c3c3';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.font = '18px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${b.code} — ${b.name}`, CANVAS_W / 2, CANVAS_H / 2 + 6);
    }

    // Draw PNG overlay
    if (b.overlayDataUrl) {
      try {
        const overlay = await loadImage(b.overlayDataUrl);
        ctx.globalAlpha = b.overlayOpacity / 100;
        // Cover the entire canvas
        const scale = Math.max(CANVAS_W / overlay.width, CANVAS_H / overlay.height);
        const w = overlay.width * scale;
        const h = overlay.height * scale;
        const x = (CANVAS_W - w) / 2;
        const y = (CANVAS_H - h) / 2;
        ctx.drawImage(overlay, x, y, w, h);
        ctx.globalAlpha = 1;
      } catch (err) {
        console.warn('Could not load overlay:', err);
        ctx.globalAlpha = 1;
      }
    }

    b.rendered = true;
    // Update visual bounding box overlay
    if (typeof updateBbox === 'function') updateBbox();
  }

  // ═══════════════════════════════════════
  // DOCX PARSING
  // ═══════════════════════════════════════

  async function parseDocx(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const result = await mammoth.extractRawText({ arrayBuffer: reader.result });
          resolve({ filename: file.name, text: result.value });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  function extractSearchTerms(docs) {
    /*  Real DOCX structure (from analysis):
     *  
     *  Hito titles:
     *    "Página Principal de Hito 01: Repaso de contabilidad intermedia para preparar estados financieros"
     *  
     *  Section activities (per week):
     *    "S01 Afianzamiento: Repaso esencial de estados financieros"
     *    "S01 Aplicación: Construcción práctica de estados financieros"
     *    "S01 Foro: ¿Qué esperas de la asignatura?"
     *    "S02 Gamificación: (Poner un nombre a la actividad)"
     *    "S17 Proyecto: Contabilidad con transparencia..."
     *    "Contenido Semana 17" (section header for content)
     */

    const allText = docs.map(d => d.text).join('\n\n');
    const lines = allText.split(/\n/);

    // ── 1) Extract Hito titles from "Página Principal de Hito XX: [title]" ──
    const hitoTitlePattern = /P[áa]gina\s+Principal\s+de\s+Hito\s+0?(\d)\s*:\s*(.+)/gi;
    const hitoMap = {};
    let match;

    while ((match = hitoTitlePattern.exec(allText)) !== null) {
      const num = match[1];
      let title = match[2].trim();
      // Remove trailing numbers (page references like "1" or "2" at end)
      title = title.replace(/\d+$/, '').trim();
      // Skip placeholder titles
      if (title.toLowerCase().includes('escribe el nombre') || title.length < 3) continue;
      if (!hitoMap[num]) {
        hitoMap[num] = title;
      }
    }

    // Apply Hito search terms (H1-H5)
    for (let i = 1; i <= 5; i++) {
      const banner = state.banners.find(b => b.id === `h${i}`);
      if (banner && hitoMap[String(i)]) {
        banner.searchTerm = hitoMap[String(i)];
        banner.aiContext = hitoMap[String(i)]; // Also set AI context
      }
    }

    // ── 2) Extract section activity names from "SXX Type: [concept]" ──
    // Maps banner IDs to the regex keyword that identifies them
    const sectionTypes = {
      afi:      /afianzamiento/i,
      aplic:    /(?:aplicaci[oó]n|taller\s+de\s+aplicaci[oó]n)/i,
      foro:     /foro/i,
      gam:      /gamificaci[oó]n/i,
      proyecto: /(?:proyecto|taller\s+de\s+proyecto)/i,
      reflex:   /(?:reflexi[oó]n|pregunta\s+reflexiva)/i,
    };

    // Pattern: "SXX Type: Concept Name" — extract the concept after the colon
    const activityPattern = /S\d{2}\s+(.+?):\s*(.+)/g;
    
    // Collect ALL concepts per type (across all Hitos/weeks)
    const conceptsByType = {};
    for (const key of Object.keys(sectionTypes)) {
      conceptsByType[key] = [];
    }

    while ((match = activityPattern.exec(allText)) !== null) {
      const typeName = match[1].trim();
      let concept = match[2].trim();
      // Remove trailing page numbers
      concept = concept.replace(/\d+$/, '').trim();
      // Skip placeholders
      if (concept.toLowerCase().includes('poner un nombre') || concept.length < 3) continue;

      for (const [bannerId, regex] of Object.entries(sectionTypes)) {
        if (regex.test(typeName)) {
          conceptsByType[bannerId].push(concept);
          break;
        }
      }
    }

    // Set the FIRST meaningful concept found for each section type as the search term
    // Also populate proposedKeywords with ALL found concepts
    for (const [bannerId, concepts] of Object.entries(conceptsByType)) {
      const banner = state.banners.find(b => b.id === bannerId);
      if (banner && concepts.length > 0) {
        banner.searchTerm = concepts[0]; // Use first real concept
        banner.aiContext = concepts[0];  // Also set AI context for prompt generation
        // Store unique concepts as proposed keywords
        banner.proposedKeywords = [...new Set(concepts)];
        console.log(`[Parser] ${banner.code}: "${concepts[0]}" (${concepts.length} found total)`);
      }
    }

    // ── 3) Content banner — extract from "Contenido Semana XX" context ──
    const contBanner = state.banners.find(b => b.id === 'cont');
    if (contBanner && !contBanner.searchTerm) {
      // Look for the subject name from "Asignatura (Código y Nombre)" pattern
      const asigPattern = /Asignatura\s*\(C[oó]digo\s+y\s+Nombre\)\s*\n?\s*(.+)/i;
      const asigMatch = asigPattern.exec(allText);
      if (asigMatch) {
        let subject = asigMatch[1].trim().replace(/\d+$/, '').trim();
        // Clean: remove codes like "CGU-511 (P-S)"
        subject = subject.replace(/^[A-Z]{2,4}\s*[-–]\s*\d+\s*(\([^)]*\)\s*)?/i, '').trim();
        if (subject.length > 3) {
          contBanner.searchTerm = subject;
          contBanner.aiContext = subject; // Also set AI context
          // AUTO-SET subject context for contextual search!
          if (!state.subjectContext) {
            state.subjectContext = subject;
            console.log(`[Parser] Subject context auto-set: "${subject}"`);
          }
          contBanner.proposedKeywords = [subject, 'contenido educativo', 'material de estudio'];
          console.log(`[Parser] CONT: "${subject}"`);
        }
      }
      if (!contBanner.searchTerm) {
        contBanner.searchTerm = 'contenido educativo';
      }
    }

    // ── 4) Plan banner — use career/program name ──
    const planBanner = state.banners.find(b => b.id === 'plan');
    if (planBanner && !planBanner.searchTerm) {
      const carreraPattern = /Carrera\(s\)\s*\n?\s*(.+)/i;
      const carreraMatch = carreraPattern.exec(allText);
      if (carreraMatch) {
        const career = carreraMatch[1].trim().replace(/\d+$/, '').trim();
        if (career.length > 3) {
          state.careerContext = career;
          planBanner.searchTerm = 'plan de estudios ' + career.toLowerCase();
          planBanner.proposedKeywords = ['plan de estudios', 'planificación', career.toLowerCase()];
          console.log(`[Parser] PLAN: "${planBanner.searchTerm}"`);
        }
      }
      if (!planBanner.searchTerm) {
        planBanner.searchTerm = 'planificación educativa';
      }
    }

    // ── 5) Fallbacks for any banner that still has no search term ──
    const fallbacks = {
      afi:      'afianzamiento educativo',
      aplic:    'aplicación práctica',
      cont:     'contenido educativo',
      plan:     'planificación académica',
      foro:     'foro de discusión',
      gam:      'gamificación educativa',
      h1:       'diagnóstico académico',
      h2:       'avance y desarrollo',
      h3:       'investigación',
      h4:       'avance y desarrollo',
      h5:       'integración académica',
      reflex:   'pregunta reflexiva',
      proyecto: 'proyecto integrador',
    };

    for (const b of state.banners) {
      if (!b.searchTerm) {
        b.searchTerm = fallbacks[b.id] || b.name;
        console.log(`[Parser] ${b.code}: fallback -> "${b.searchTerm}"`);
      }
      // Ensure proposedKeywords always has at least the searchTerm
      if (!b.proposedKeywords || b.proposedKeywords.length === 0) {
        b.proposedKeywords = [b.searchTerm];
      }
      // Also add hito title as a keyword for Hito banners
      if (b.id.startsWith('h') && hitoMap[b.id.replace('h', '')]) {
        const hitoTitle = hitoMap[b.id.replace('h', '')];
        if (!b.proposedKeywords.includes(hitoTitle)) {
          b.proposedKeywords.unshift(hitoTitle);
        }
      }
    }

    // Log summary
    console.log('[Parser] === Extraction Summary ===');
    console.log(`  Subject: "${state.subjectContext}"`);
    console.log(`  Career: "${state.careerContext}"`);
    state.banners.forEach(b => console.log(`  ${b.code.padEnd(10)} -> "${b.searchTerm}" [keywords: ${b.proposedKeywords.join(', ')}]`));
  }

  // ═══════════════════════════════════════
  // DOCX UPLOAD HANDLER
  // ═══════════════════════════════════════

  async function handleDocxUpload(files) {
    if (!files.length) return;

    showLoading(`Procesando ${files.length} documento(s)...`);

    try {
      const docs = [];
      for (const file of files) {
        if (!file.name.endsWith('.docx')) {
          toast(`${file.name} no es un DOCX, ignorado`, 'error');
          continue;
        }
        const parsed = await parseDocx(file);
        docs.push(parsed);
        state.loadedDocs.push(file.name);
      }

      if (docs.length > 0) {
        // Extract docPrefix from first loaded doc (e.g., "CGU-511" from "CGU-511.docx")
        if (!state.docPrefix && state.loadedDocs.length > 0) {
          const firstDoc = state.loadedDocs[0];
          // Extract sigla code from filename (e.g., "DEL-611" from "DEL-611 02 Hito 1 Herramienta docente.docx")
          const siglaMatch = firstDoc.match(/([A-Za-z]{2,5}[-_]\d{2,4})/);
          state.docPrefix = siglaMatch ? siglaMatch[1].toUpperCase() : firstDoc.replace(/\.docx$/i, '').split(/[\s_]/)[0];
          console.log('docPrefix set to:', state.docPrefix);
        }
        extractSearchTerms(docs);
        renderLoadedDocs();
        renderBannerList();
        renderEditor();
        toast(`${docs.length} documento(s) procesado(s)`, 'success');
        dom.searchAllBtn.disabled = false;
        dom.downloadAllBtn.disabled = false; // Enable ZIP download after loading docs
      }
    } catch (err) {
      console.error(err);
      toast('Error procesando DOCX: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  }

  function renderLoadedDocs() {
    if (state.loadedDocs.length === 0) {
      dom.loadedDocs.innerHTML = '<span style="font-size:0.7rem; color:var(--text-muted);">Ningún documento cargado</span>';
      return;
    }
    dom.loadedDocs.innerHTML = state.loadedDocs.map(name => `
      <span class="doc-chip">
          <span class="doc-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>
        ${name.length > 30 ? name.substring(0, 27) + '...' : name}
        <span class="doc-check">✓</span>
      </span>
    `).join('');
  }

  // ═══════════════════════════════════════
  // SEARCH ALL
  // ═══════════════════════════════════════

  async function searchAllBanners() {
    showLoading('Buscando imágenes para todos los banners...');
    let searched = 0;
    for (const b of state.banners) {
      if (b.searchTerm) {
        dom.loadingText.textContent = `Buscando: ${b.code} — "${b.searchTerm}" (${searched + 1}/${state.banners.filter(x => x.searchTerm).length})`;
        await searchPexels(b);
        searched++;
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 300));
      }
    }
    hideLoading();
    renderBannerList();
    if (state.activeBannerId) renderEditor();
    toast(`Búsqueda completada: ${searched} banners procesados`, 'success');
    dom.downloadAllBtn.disabled = false;
  }

  // ═══════════════════════════════════════
  // DOWNLOAD
  // ═══════════════════════════════════════

  function downloadSingleBanner() {
    const b = getActiveBanner();
    if (!b) return;

    const link = document.createElement('a');
    const prefix = state.docPrefix ? state.docPrefix + '_' : '';
    const format = EXPORT_FORMAT;
    const quality = EXPORT_QUALITY / 100;
    const ext = format === 'image/jpeg' ? 'jpg' : 'png';
    
    link.download = `${prefix}${b.filename}.${ext}`;
    link.href = dom.canvas.toDataURL(format, quality);
    link.click();
    toast(`Banner ${b.code} descargado`, 'success');
  }

  async function downloadAllAsZip() {
    showLoading('Generando ZIP con todos los banners...');

    try {
      const zip = new JSZip();
      const offCanvas = document.createElement('canvas');
      const offCtx = offCanvas.getContext('2d');

      let count = 0;
      for (const b of state.banners) {
        if (!b.bgImageUrl && !b.overlayDataUrl) continue;

        dom.loadingText.textContent = `Renderizando ${b.code}... (${count + 1})`;

        offCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        offCtx.fillStyle = b.bgColor || '#c3c3c3';
        offCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Background
        if (b.bgImageUrl) {
          try {
            const img = await loadImage(b.bgImageUrl);
            const baseScale = Math.max(CANVAS_W / img.width, CANVAS_H / img.height);
            const userScale = (b.bgScale || 100) / 100;
            const scale = baseScale * userScale;
            const w = img.width * scale;
            const h = img.height * scale;
            const x = (CANVAS_W - w) / 2 + (b.bgOffsetX || 0);
            const y = (CANVAS_H - h) / 2 + (b.bgOffsetY || 0);
            offCtx.globalAlpha = (b.brightness || 40) / 100;
            if (b.bgFlipX) {
              offCtx.save();
              offCtx.scale(-1, 1);
              offCtx.drawImage(img, -x - w, y, w, h);
              offCtx.restore();
            } else {
              offCtx.drawImage(img, x, y, w, h);
            }
            offCtx.globalAlpha = 1;
          } catch (e) {
            console.warn(`Skipping bg for ${b.code}:`, e);
          }
        }

        // Overlay
        if (b.overlayDataUrl) {
          try {
            const overlay = await loadImage(b.overlayDataUrl);
            offCtx.globalAlpha = b.overlayOpacity / 100;
            const scale = Math.max(CANVAS_W / overlay.width, CANVAS_H / overlay.height);
            const w = overlay.width * scale;
            const h = overlay.height * scale;
            const x = (CANVAS_W - w) / 2;
            const y = (CANVAS_H - h) / 2;
            offCtx.drawImage(overlay, x, y, w, h);
            offCtx.globalAlpha = 1;
          } catch (e) {
            console.warn(`Skipping overlay for ${b.code}:`, e);
            offCtx.globalAlpha = 1;
          }
        }

        // Add to ZIP with selected format and quality
        const format = EXPORT_FORMAT;
        const quality = EXPORT_QUALITY / 100;
        const ext = format === 'image/jpeg' ? 'jpg' : 'png';
        
        const dataUrl = offCanvas.toDataURL(format, quality);
        const base64 = dataUrl.split(',')[1];
        const prefix = state.docPrefix ? state.docPrefix + '_' : '';
        zip.file(`${prefix}${b.filename}.${ext}`, base64, { base64: true });
        count++;
      }

      if (count === 0) {
        hideLoading();
        toast('No hay banners con imágenes para descargar', 'error');
        return;
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      const zipName = state.docPrefix ? `${state.docPrefix}_banners.zip` : 'banners_edtech.zip';
      link.download = zipName;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
      toast(`ZIP generado con ${count} banners`, 'success');
    } catch (err) {
      console.error('Download All ZIP error:', err);
      toast('Error creando el ZIP: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  }

  async function downloadAllPsdAsZip() {
    if (state.banners.filter(b => b.aiGeneratedUrl).length === 0) {
      toast('No hay banners con imágenes generadas por IA', 'warning');
      return;
    }

    showLoading('Preparando ZIP con PSDs...');
    try {
      const zip = new JSZip();
      let count = 0;

      for (const b of state.banners) {
        if (!b.aiGeneratedUrl) continue;
        
        dom.loadingText.textContent = `Creando PSD ${b.code}... (${count + 1})`;
        try {
          const aiImg = await loadImage(b.aiGeneratedUrl);
          const buffer = await createPsdBuffer(b, aiImg.width, aiImg.height, aiImg);
          const prefix = state.docPrefix ? state.docPrefix + '_' : '';
          zip.file(`${prefix}${b.filename}_editable.psd`, buffer);
          count++;
        } catch (err) {
          console.warn(`Error creando PSD para ${b.code}:`, err);
        }
      }

      if (count === 0) {
        hideLoading();
        toast('No se pudo generar ningún PSD', 'error');
        return;
      }

      dom.loadingText.textContent = 'Comprimiendo ZIP...';
      const blob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      const zipName = state.docPrefix ? `${state.docPrefix}_psd.zip` : 'banners_editable_psd.zip';
      link.download = zipName;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
      toast('Multi-PSD ZIP descargado', 'success');
    } catch (err) {
      console.error('ZIP PSD error:', err);
      toast('Error creando ZIP: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  }

  // ═══════════════════════════════════════
  // RENDER ALL
  // ═══════════════════════════════════════

  async function renderAllBanners() {
    for (const b of state.banners) {
      if (b.searchTerm && !b.bgImageUrl && b.pexelsResults.length > 0) {
        b.bgImageUrl = b.pexelsResults[0]._largeUrl;
        b.bgImageThumb = b.pexelsResults[0]._thumbUrl;
      }
    }
    renderBannerList();
    if (state.activeBannerId) {
      renderEditor();
      renderCanvas();
    }
    toast('Todos los banners actualizados con primera imagen disponible', 'success');
    dom.downloadAllBtn.disabled = false;
  }

  // ═══════════════════════════════════════
  // TOOLBAR CONTROLS
  // ═══════════════════════════════════════

  dom.bgBrightness.addEventListener('input', () => {
    const b = getActiveBanner();
    if (!b) return;
    b.brightness = parseInt(dom.bgBrightness.value);
    dom.bgBrightnessVal.textContent = b.brightness + '%';
    renderCanvas();
  });

  // Canvas toolbar color picker
  dom.bgColorPicker.addEventListener('input', () => {
    const b = getActiveBanner();
    if (!b) return;
    b.bgColor = dom.bgColorPicker.value;
    dom.bgColorHex.value = dom.bgColorPicker.value;
    // Sync editor controls if open
    const edColor = $('#editor-bg-color');
    const edHex = $('#editor-bg-color-hex');
    if (edColor) edColor.value = b.bgColor;
    if (edHex) edHex.value = b.bgColor;
    renderCanvas();
  });

  dom.bgColorHex.addEventListener('change', () => {
    const b = getActiveBanner();
    if (!b) return;
    let val = dom.bgColorHex.value.trim();
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      b.bgColor = val;
      dom.bgColorPicker.value = val;
      const edColor = $('#editor-bg-color');
      const edHex = $('#editor-bg-color-hex');
      if (edColor) edColor.value = val;
      if (edHex) edHex.value = val;
      renderCanvas();
    } else {
      toast('Formato hex inválido (Ej: #c3c3c3)', 'error');
      dom.bgColorHex.value = b.bgColor || '#c3c3c3';
    }
  });

  dom.overlayOpacity.addEventListener('input', () => {
    const b = getActiveBanner();
    if (!b) return;
    b.overlayOpacity = parseInt(dom.overlayOpacity.value);
    dom.overlayOpacityVal.textContent = b.overlayOpacity + '%';
    renderCanvas();
  });

  // ═══════════════════════════════════════
  // EVENT BINDINGS
  // ═══════════════════════════════════════

  dom.docxUpload.addEventListener('change', () => {
    handleDocxUpload(Array.from(dom.docxUpload.files));
    dom.docxUpload.value = '';
  });

  dom.searchAllBtn.addEventListener('click', searchAllBanners);
  dom.downloadAllBtn.addEventListener('click', downloadAllAsZip);
  dom.renderAllBtn.addEventListener('click', renderAllBanners);
  dom.btnDownloadSingle.addEventListener('click', downloadSingleBanner);

  // Global Paste (Ctrl+V / Cmd+V)
  document.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (const item of items) {
      if (item.type.indexOf('image') === 0) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const b = getActiveBanner();
        if (b) {
          b.bgImageUrl = URL.createObjectURL(file);
          b.bgOffsetX = 0;
          b.bgOffsetY = 0;
          b.bgScale = 100;
          b.bgFlipX = false;
          renderEditor();
          renderCanvas();
          toast('Imagen pegada del portapapeles', 'success');
        } else {
          toast('Selecciona un banner primero para pegar la imagen', 'warning');
        }
        break; // Process only the first image found
      }
    }
  });

  // Global overlay upload (applies to all banners)
  const overlayInput = $('#overlay-file-input');
  const overlayDrop = $('#overlay-drop-zone');
  const overlayPreview = $('#overlay-preview');

  if (overlayDrop) {
    overlayDrop.addEventListener('click', () => overlayInput.click());
    overlayDrop.addEventListener('dragover', e => { e.preventDefault(); overlayDrop.classList.add('dragover'); });
    overlayDrop.addEventListener('dragleave', () => overlayDrop.classList.remove('dragover'));
    overlayDrop.addEventListener('drop', e => {
      e.preventDefault();
      overlayDrop.classList.remove('dragover');
      if (e.dataTransfer.files.length) handleOverlayFile(e.dataTransfer.files[0]);
    });
  }
  if (overlayInput) {
    overlayInput.addEventListener('change', () => {
      if (overlayInput.files.length) handleOverlayFile(overlayInput.files[0]);
      overlayInput.value = '';
    });
  }
  // Remove overlay from all banners
  const btnRemoveOverlay = $('#btn-remove-overlay');
  if (btnRemoveOverlay) {
    btnRemoveOverlay.addEventListener('click', () => {
      state.banners.forEach(b => { b.overlayDataUrl = null; });
      if (overlayPreview) {
        overlayPreview.classList.remove('visible');
        const img = overlayPreview.querySelector('img');
        if (img) img.remove();
      }
      renderEditor();
      renderCanvas();
      renderBannerList();
      toast('Overlay removido de todos los banners', 'info');
    });
  }

  // ── Default Overlay Preload ──
  async function loadDefaultOverlay() {
    try {
      let dataUrl = localStorage.getItem('edtech_global_overlay');
      if (!dataUrl) {
        const res = await fetch('banner_overlay.png');
        if (!res.ok) throw new Error('Default overlay not found');
        const blob = await res.blob();
        dataUrl = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(blob);
        });
      }
      
      // Apply to all banners that don't already have one
      state.banners.forEach(b => {
        if (!b.overlayDataUrl && !b.hideOverlay) b.overlayDataUrl = dataUrl;
      });
      renderEditor();
      renderCanvas();
    } catch (err) {
      console.log('No default overlay found silently skipping.');
    }
  }

  // ═══════════════════════════════════════
  // VISUAL BOUNDING BOX — Drag & Resize
  // ═══════════════════════════════════════

  // Calculate where the image sits in display (CSS) coords and position overlay
  function updateBbox() {
    const b = getActiveBanner();
    if (!b || !b.bgImageUrl) {
      dom.bboxOverlay.style.display = 'none';
      return;
    }

    // We need the image's natural dimensions to calculate its rect
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = b.bgImageUrl;
    
    const CANVAS_W = getCanvasW(b);
    const CANVAS_H = getCanvasH(b);

    // Use cached dimensions if available
    const iw = img.naturalWidth || img.width || CANVAS_W;
    const ih = img.naturalHeight || img.height || CANVAS_H;

    // Calculate what renderCanvas draws
    const baseScale = Math.max(CANVAS_W / iw, CANVAS_H / ih);
    const userScale = (b.bgScale || 100) / 100;
    const scale = baseScale * userScale;
    const imgW = iw * scale;   // image width in canvas coords
    const imgH = ih * scale;   // image height in canvas coords
    const imgX = (CANVAS_W - imgW) / 2 + (b.bgOffsetX || 0);
    const imgY = (CANVAS_H - imgH) / 2 + (b.bgOffsetY || 0);

    // Convert from canvas coords to display (CSS pixel) coords
    const canvasRect = dom.canvas.getBoundingClientRect();
    const displayScaleX = canvasRect.width / CANVAS_W;
    const displayScaleY = canvasRect.height / CANVAS_H;

    // Add the canvas's own left/top offset within its wrapper since it's now margin:auto centered
    const canvasLeft = dom.canvas.offsetLeft;
    const canvasTop = dom.canvas.offsetTop;

    const left   = (imgX * displayScaleX) + canvasLeft;
    const top    = (imgY * displayScaleY) + canvasTop;
    const width  = imgW * displayScaleX;
    const height = imgH * displayScaleY;

    dom.bboxOverlay.style.display = 'block';
    dom.bboxOverlay.style.left   = left + 'px';
    dom.bboxOverlay.style.top    = top + 'px';
    dom.bboxOverlay.style.width  = width + 'px';
    dom.bboxOverlay.style.height = height + 'px';

    // Update info label
    let infoEl = dom.bboxOverlay.querySelector('.bbox-info');
    if (!infoEl) {
      infoEl = document.createElement('div');
      infoEl.className = 'bbox-info';
      dom.bboxOverlay.appendChild(infoEl);
    }
    infoEl.textContent = `${Math.round(imgW)}×${Math.round(imgH)} | ${b.bgScale || 100}% | x:${Math.round(b.bgOffsetX||0)} y:${Math.round(b.bgOffsetY||0)}`;
  }

  // === Drag & Resize Interaction ===
  let bboxAction = null; // { type: 'move'|'resize', handle?, startX, startY, startOffX, startOffY, startScale }

  // Move — drag on the border area
  dom.bboxOverlay.querySelector('.bbox-border').addEventListener('mousedown', (e) => {
    e.preventDefault();
    const b = getActiveBanner();
    if (!b) return;
    bboxAction = {
      type: 'move',
      startX: e.clientX,
      startY: e.clientY,
      startOffX: b.bgOffsetX || 0,
      startOffY: b.bgOffsetY || 0,
    };
  });

  // Resize — drag on handles
  dom.bboxOverlay.querySelectorAll('.bbox-handle').forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const b = getActiveBanner();
      if (!b) return;
      bboxAction = {
        type: 'resize',
        handle: handle.dataset.handle,
        startX: e.clientX,
        startY: e.clientY,
        startScale: b.bgScale || 100,
        startOffX: b.bgOffsetX || 0,
        startOffY: b.bgOffsetY || 0,
      };
    });
  });

  document.addEventListener('mousemove', (e) => {
    if (!bboxAction) return;
    const b = getActiveBanner();
    if (!b) return;

    const CANVAS_W = getCanvasW(b);
    const CANVAS_H = getCanvasH(b);

    const canvasRect = dom.canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / canvasRect.width;
    const scaleY = CANVAS_H / canvasRect.height;

    const dx = (e.clientX - bboxAction.startX) * scaleX;
    const dy = (e.clientY - bboxAction.startY) * scaleY;

    if (bboxAction.type === 'move') {
      b.bgOffsetX = bboxAction.startOffX + dx;
      b.bgOffsetY = bboxAction.startOffY + dy;
    } else if (bboxAction.type === 'resize') {
      // Scale change based on drag distance (symmetrical for corner handles)
      const h = bboxAction.handle;
      let delta = 0;
      if (h === 'se' || h === 'e' || h === 'ne') delta = dx;
      else if (h === 'sw' || h === 'w' || h === 'nw') delta = -dx;
      else if (h === 's') delta = dy;
      else if (h === 'n') delta = -dy;

      // Convert pixel drag to scale percentage (500px drag = ±100%)
      const scaleDelta = (delta / 500) * 100;
      b.bgScale = Math.max(20, Math.min(300, bboxAction.startScale + scaleDelta));
    }

    renderCanvas();
    updateBbox();
  });

  document.addEventListener('mouseup', () => {
    if (bboxAction) {
      bboxAction = null;
      renderEditor(); // update sliders to match new values
    }
  });
  // ═══════════════════════════════════════
  // CANVAS RIGHT-CLICK CONTEXT MENU
  // ═══════════════════════════════════════

  // Create context menu element
  const ctxMenu = document.createElement('div');
  ctxMenu.id = 'canvas-context-menu';
  ctxMenu.style.cssText = 'display:none; position:fixed; z-index:9999; background:var(--bg-secondary); border:1px solid var(--border); border-radius:6px; padding:4px 0; min-width:180px; box-shadow:0 8px 24px rgba(0,0,0,0.4); font-size:0.75rem;';
  ctxMenu.innerHTML = `
    <div class="ctx-item" data-action="flip" style="display:flex; align-items:center; gap:8px; padding:6px 14px; cursor:pointer; color:var(--text-primary); transition:background 0.15s;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
      Flip horizontal
    </div>
    <div class="ctx-item" data-action="center" style="display:flex; align-items:center; gap:8px; padding:6px 14px; cursor:pointer; color:var(--text-primary); transition:background 0.15s;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
      Centrar imagen
    </div>
    <div style="height:1px; background:var(--border); margin:4px 0;"></div>
    <div class="ctx-item" data-action="download" style="display:flex; align-items:center; gap:8px; padding:6px 14px; cursor:pointer; color:var(--text-primary); transition:background 0.15s;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Descargar PNG
    </div>
  `;
  document.body.appendChild(ctxMenu);

  // Hover effect
  ctxMenu.querySelectorAll('.ctx-item').forEach(item => {
    item.addEventListener('mouseenter', () => item.style.background = 'var(--accent-glow)');
    item.addEventListener('mouseleave', () => item.style.background = 'transparent');
  });

  // Show on right-click on the canvas container
  const canvasContainer = $('#canvas-container');
  if (canvasContainer) {
    canvasContainer.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const b = getActiveBanner();
      if (!b) return;
      ctxMenu.style.display = 'block';
      ctxMenu.style.left = e.clientX + 'px';
      ctxMenu.style.top = e.clientY + 'px';
      // Keep menu within viewport
      const rect = ctxMenu.getBoundingClientRect();
      if (rect.right > window.innerWidth) ctxMenu.style.left = (window.innerWidth - rect.width - 8) + 'px';
      if (rect.bottom > window.innerHeight) ctxMenu.style.top = (window.innerHeight - rect.height - 8) + 'px';
    });
  }

  // Handle actions
  ctxMenu.addEventListener('click', (e) => {
    const item = e.target.closest('.ctx-item');
    if (!item) return;
    const action = item.dataset.action;
    const b = getActiveBanner();
    ctxMenu.style.display = 'none';
    if (!b) return;
    if (action === 'flip') {
      b.bgFlipX = !b.bgFlipX;
      renderCanvas();
      toast(b.bgFlipX ? 'Imagen volteada' : 'Imagen normal', 'info');
    } else if (action === 'center') {
      b.bgOffsetX = 0;
      b.bgOffsetY = 0;
      b.bgScale = 100;
      b.bgFlipX = false;
      renderCanvas();
      renderEditor();
      toast('Posición reiniciada', 'info');
    } else if (action === 'download') {
      downloadSinglePng(b);
    }
  });

  // Dismiss on click outside
  document.addEventListener('click', () => ctxMenu.style.display = 'none');

  // ═══════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════

  function init() {
    renderBannerList();
    renderLoadedDocs();

    // Logout button
    const btnLogout = $('#btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        localStorage.removeItem('edtech_banner_session');
        location.reload();
      });
    }

    // Settings Modal
    const btnSettings = $('#btn-settings');
    const modalSettings = $('#settings-modal');
    if (btnSettings && modalSettings) {
      const cfgHfToken = $('#cfg-hf-token');
      const cfgPexelsToken = $('#cfg-pexels-token');
      const cfgExportFormat = $('#cfg-export-format');
      const cfgExportQuality = $('#cfg-export-quality');
      const cfgQualityVal = $('#cfg-quality-val');
      
      // Update quality slider display
      if (cfgExportQuality && cfgQualityVal) {
        cfgExportQuality.addEventListener('input', e => {
          cfgQualityVal.textContent = e.target.value + '%';
        });
      }

      const cfgOverlayUpload = $('#cfg-overlay-upload');
      if (cfgOverlayUpload) {
        cfgOverlayUpload.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target.result;
            try {
              localStorage.setItem('edtech_global_overlay', dataUrl);
              const label = $('#cfg-overlay-name');
              if (label) label.textContent = file.name;
              toast('Capa PNG Global actualizada', 'success');
              loadDefaultOverlay(); // apply instantly
            } catch (err) {
              toast('El archivo PNG es demasiado grande para guardarse en localStorage', 'error');
            }
          };
          reader.readAsDataURL(file);
        });
      }
      
      btnSettings.addEventListener('click', () => {
        cfgHfToken.value = localStorage.getItem('hf_token') || '';
        cfgPexelsToken.value = localStorage.getItem('edtech_pexels_token') || '';
        if(cfgExportFormat) cfgExportFormat.value = EXPORT_FORMAT;
        if(cfgExportQuality) {
          cfgExportQuality.value = EXPORT_QUALITY;
          if(cfgQualityVal) cfgQualityVal.textContent = EXPORT_QUALITY + '%';
        }
        const overlayName = $('#cfg-overlay-name');
        if (overlayName) {
          overlayName.textContent = localStorage.getItem('edtech_global_overlay') ? 'Custom PNG Cargado' : 'banner_overlay.png (default)';
        }
        modalSettings.style.display = 'flex';
      });

      $('#btn-close-settings').addEventListener('click', () => modalSettings.style.display = 'none');
      $('#btn-cancel-settings').addEventListener('click', () => modalSettings.style.display = 'none');
      
      $('#btn-save-settings').addEventListener('click', () => {
        const newHf = cfgHfToken.value.trim();
        const newPexels = cfgPexelsToken.value.trim();
        
        if (newHf) {
          localStorage.setItem('hf_token', newHf);
          HF_TOKEN = newHf;
        } else {
          localStorage.removeItem('hf_token');
          HF_TOKEN = '';
        }

        if (newPexels) {
          localStorage.setItem('edtech_pexels_token', newPexels);
          PEXELS_KEY = newPexels;
        } else {
          localStorage.removeItem('edtech_pexels_token');
          PEXELS_KEY = DEFAULT_PEXELS_KEY;
        }

        if (cfgExportFormat && cfgExportQuality) {
          EXPORT_FORMAT = cfgExportFormat.value;
          EXPORT_QUALITY = parseInt(cfgExportQuality.value, 10);
          localStorage.setItem('edtech_export_format', EXPORT_FORMAT);
          localStorage.setItem('edtech_export_quality', EXPORT_QUALITY.toString());
        }

        modalSettings.style.display = 'none';
        toast('Configuración guardada', 'success');
      });
    }

    // Load default overlay
    loadDefaultOverlay();

    console.log('[EDTECH Banner Generator] Ready — 14 banners configured');
  }

  init();

})();
