const RECIPES = window.MUGE_RECIPES || [];

const CATEGORIES = [
  { key: '火锅', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16v3a5 5 0 01-5 5H9a5 5 0 01-5-5v-3z"/><path d="M2 12h20"/><path d="M9 8c0-1.5 1-2.5 1-4"/><path d="M14 8c0-1.5 1-2.5 1-4"/><path d="M8 22h8"/></svg>` },
  { key: '小炒', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 13h14a5 5 0 01-5 5H8a5 5 0 01-5-5z"/><path d="M17 13l4-3"/><path d="M9 9V6"/></svg>` },
  { key: '素菜', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M11 20A7 7 0 014 13c0-5 7-9 16-9 0 9-4 16-9 16z"/><path d="M4 20l7-7"/></svg>` },
  { key: '煲汤', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 10h14v5a6 6 0 01-6 6h-2a6 6 0 01-6-6v-5z"/><path d="M3 10h18"/><path d="M9 6h6"/></svg>` }
];

const TASTES = [
  { key: '不限', label: '不限口味', desc: '均衡搭配各类菜品' },
  { key: '下饭', label: '更下饭', desc: '浓香酱汁、拌饭首选' },
  { key: '清淡', label: '更清淡', desc: '少油爽口、清甜暖胃' },
  { key: '快手', label: '快手省事', desc: '优先 15 分钟内搞定' }
];

const TIER_META = {
  1: { tag: '最先起锅 · 长时炖煮', short: '先炖煮' },
  2: { tag: '趁炖煮间隙 · 主菜处理', short: '主菜先做' },
  3: { tag: '中段现炒 · 热菜主攻', short: '中段热炒' },
  4: { tag: '靠后快炒 · 素菜保脆', short: '素菜后炒' },
  5: { tag: '最后收尾 · 滚煮鲜喝', short: '快汤收尾' }
};

const DINER_PRESETS = [
  { label: '1人', diners: 1, hotpots: 0, stirFries: 1, soups: 1 },
  { label: '2人', diners: 2, hotpots: 0, stirFries: 2, soups: 1 },
  { label: '3人', diners: 3, hotpots: 1, stirFries: 2, soups: 1 },
  { label: '4人', diners: 4, hotpots: 1, stirFries: 3, soups: 1 },
  { label: '5人+', diners: 5, hotpots: 1, stirFries: 4, soups: 1 }
];

let activeTab = 'home';
let activeCategory = '全部';
let searchQuery = '';

let selectedDiners = 2;
let targetHotpotCount = 0;
let targetStirFryCount = 2;
let targetSoupCount = 1;
let selectedTaste = '不限';
let randomHotpots = [];
let randomDishes = [];
let randomSoups = [];
let checkedRandomIngs = new Set();

let savedIds = new Set();
let checkedSavedIngs = new Set();
let activeCookDishId = null;
let completedSteps = {};
let completedDishes = new Set();
let stepMode = 'detail';
let timerState = { key: null, remaining: 0, intervalId: null };
let currentDetailId = null;

function persistState() {
  try {
    const stepObj = {};
    Object.keys(completedSteps).forEach(k => {
      stepObj[k] = Array.from(completedSteps[k]);
    });
    localStorage.setItem('muge_state_v1', JSON.stringify({
      savedIds: Array.from(savedIds),
      checkedSavedIngs: Array.from(checkedSavedIngs),
      completedDishes: Array.from(completedDishes),
      completedSteps: stepObj,
      stepMode
    }));
  } catch (e) {}
}

function hydrateState() {
  try {
    const raw = localStorage.getItem('muge_state_v1');
    if (!raw) return;
    const data = JSON.parse(raw);
    savedIds = new Set(data.savedIds || []);
    checkedSavedIngs = new Set(data.checkedSavedIngs || []);
    completedDishes = new Set(data.completedDishes || []);
    completedSteps = {};
    if (data.completedSteps) {
      Object.keys(data.completedSteps).forEach(k => {
        completedSteps[k] = new Set(data.completedSteps[k]);
      });
    }
    if (data.stepMode === 'brief' || data.stepMode === 'detail') stepMode = data.stepMode;
  } catch (e) {}
}

function switchTab(tab) {
  activeTab = tab;
  ['home', 'random', 'list', 'cook'].forEach(t => {
    document.getElementById(`view-${t}`).classList.toggle('hidden', t !== tab);
    document.getElementById(`nav-${t}`).classList.toggle('active', t === tab);
  });
  document.getElementById('main-scroll').scrollTop = 0;
  if (tab === 'list') renderSavedTab();
  if (tab === 'cook') renderCookTab();
}

function sortDishesLogically(recipeList) {
  return [...recipeList].sort((a, b) => {
    if (a.cookTier !== b.cookTier) return a.cookTier - b.cookTier;
    return b.minutes - a.minutes;
  });
}

function getOrderedSavedRecipes() {
  return sortDishesLogically(RECIPES.filter(r => savedIds.has(r.id)));
}

function buildFlowSummary(ordered) {
  if (ordered.length === 1) {
    const d = ordered[0];
    return `本餐 1 道菜：按「${TIER_META[d.cookTier].short}」节奏直接开始制作即可。`;
  }
  return '推荐动线：' + ordered.map((d, i) => `${i + 1}.${d.name}（${TIER_META[d.cookTier].short}）`).join(' → ');
}

/* ==================== TAB 1: 分类 ==================== */
function renderCategoryGrid() {
  const grid = document.getElementById('category-grid');
  const showAllBtn = document.getElementById('btn-show-all');
  showAllBtn.style.color = activeCategory === '全部' ? 'var(--text)' : 'var(--muted)';
  showAllBtn.style.fontWeight = activeCategory === '全部' ? '600' : '400';

  grid.innerHTML = CATEGORIES.map(cat => {
    const isActive = activeCategory === cat.key;
    const count = RECIPES.filter(r => r.category === cat.key).length;
    return `
      <button class="cat-card ${isActive ? 'active' : ''}" onclick="selectCategory('${cat.key}')">
        <div>${cat.icon}</div>
        <span class="xs" style="font-weight:500; line-height:1;">${cat.key}</span>
        <span class="cat-count">${count}道</span>
      </button>
    `;
  }).join('');
}

function selectCategory(cat) {
  activeCategory = (activeCategory === cat && cat !== '全部') ? '全部' : cat;
  renderCategoryGrid();
  renderHomeList();
}

function handleSearch(val) {
  searchQuery = val.trim();
  document.getElementById('clear-search').classList.toggle('hidden', !searchQuery);
  renderHomeList();
}

function clearSearch() {
  searchQuery = '';
  document.getElementById('search-input').value = '';
  document.getElementById('clear-search').classList.add('hidden');
  renderHomeList();
}

function resetHomeFilters() {
  activeCategory = '全部';
  clearSearch();
  renderCategoryGrid();
  renderHomeList();
}

function renderHomeList() {
  const q = searchQuery.toLowerCase();
  const filtered = RECIPES.filter(r => {
    const matchCat = activeCategory === '全部' || r.category === activeCategory;
    const matchQ = !q ||
      r.name.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      (r.cuisine && r.cuisine.includes(q)) ||
      (r.region && r.region.includes(q)) ||
      r.tastes.some(t => t.includes(q)) ||
      r.main.some(i => i.name.toLowerCase().includes(q));
    return matchCat && matchQ;
  });

  document.getElementById('home-list-title').textContent = searchQuery
    ? `搜索「${searchQuery}」`
    : (activeCategory === '全部' ? '全部菜品' : activeCategory);
  document.getElementById('home-list-count').textContent = `${filtered.length} 道`;

  const listEl = document.getElementById('home-recipe-list');
  const emptyEl = document.getElementById('home-empty');
  if (filtered.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  listEl.innerHTML = filtered.map(r => {
    const isSaved = savedIds.has(r.id);
    return `
      <div class="dish-card" onclick="openDetail(${r.id})">
        <div class="dish-main">
          <div class="pill-wrap" style="gap:6px; align-items:center;">
            <span class="dish-name">${r.name}</span>
            <span class="tag">${r.category}</span>
            <span class="xxs subtle">${TIER_META[r.cookTier].short}</span>
          </div>
          <div class="dish-meta">${r.main.map(i => i.name).join('、')} · ${r.minutes} 分钟</div>
        </div>
        <button class="plus-btn ${isSaved ? 'saved' : ''}" onclick="toggleSaveQuick(event, ${r.id})" aria-label="加入或移出清单">
          ${isSaved
            ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
            : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
          }
        </button>
      </div>
    `;
  }).join('');
}

function toggleSaveQuick(e, id) {
  e.stopPropagation();
  if (savedIds.has(id)) {
    savedIds.delete(id);
    showToast('已移出备菜清单');
  } else {
    savedIds.add(id);
    showToast('已加入备菜清单');
  }
  persistState();
  updateBadges();
  renderHomeList();
}

/* ==================== TAB 2: 随机 ==================== */
function formatMealHint(hp, sf, sp) {
  const parts = [];
  if (hp > 0) parts.push(`${hp} 锅`);
  if (sf > 0) parts.push(`${sf} 炒菜`);
  if (sp > 0) parts.push(`${sp} 汤`);
  return parts.length > 0 ? parts.join(' · ') : '未选菜品';
}

function renderRandomControls() {
  document.getElementById('diner-pills').innerHTML = DINER_PRESETS.map(p => `
    <button class="diner-pill ${p.diners === selectedDiners ? 'active' : ''}" onclick="selectDiners(${p.diners})">${p.label}</button>
  `).join('');

  document.getElementById('hotpot-count-val').textContent = targetHotpotCount;
  document.getElementById('stirfry-count-val').textContent = targetStirFryCount;
  document.getElementById('soup-count-val').textContent = targetSoupCount;
  document.getElementById('diner-hint').textContent = formatMealHint(targetHotpotCount, targetStirFryCount, targetSoupCount);

  const activeTasteObj = TASTES.find(t => t.key === selectedTaste) || TASTES[0];
  document.getElementById('taste-desc').textContent = activeTasteObj.desc;
  document.getElementById('taste-pills').innerHTML = TASTES.map(t => `
    <button class="pill-btn ${t.key === selectedTaste ? 'active' : ''}" onclick="selectTaste('${t.key}')">${t.label}</button>
  `).join('');
}

function selectDiners(num) {
  selectedDiners = num;
  const preset = DINER_PRESETS.find(p => p.diners === num);
  if (preset) {
    targetHotpotCount = preset.hotpots;
    targetStirFryCount = preset.stirFries;
    targetSoupCount = preset.soups;
  }
  renderRandomControls();
}

function adjustCount(type, delta) {
  if (type === 'hotpot') targetHotpotCount = Math.max(0, Math.min(2, targetHotpotCount + delta));
  else if (type === 'stirfry') targetStirFryCount = Math.max(0, Math.min(6, targetStirFryCount + delta));
  else targetSoupCount = Math.max(0, Math.min(1, targetSoupCount + delta));
  renderRandomControls();
}

function selectTaste(key) {
  selectedTaste = key;
  renderRandomControls();
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickWeightedPool(candidates) {
  if (selectedTaste === '不限') return shuffle(candidates);
  const matched = shuffle(candidates.filter(r => r.tastes.includes(selectedTaste)));
  const rest = shuffle(candidates.filter(r => !r.tastes.includes(selectedTaste)));
  return [...matched, ...rest];
}

function generateRandomMenu() {
  if (targetHotpotCount + targetStirFryCount + targetSoupCount === 0) {
    return showToast('请至少选择 1 道火锅、炒菜或煲汤');
  }
  const usedIds = new Set();

  const pickedHotpots = pickWeightedPool(RECIPES.filter(r => r.category === '火锅')).slice(0, targetHotpotCount);
  pickedHotpots.forEach(r => usedIds.add(r.id));

  const pickedDishes = [];
  let vegCount = 0;
  if (targetStirFryCount === 1) vegCount = selectedTaste === '清淡' ? 1 : 0;
  else if (targetStirFryCount === 2) vegCount = 1;
  else if (targetStirFryCount === 3) vegCount = selectedTaste === '清淡' ? 2 : 1;
  else if (targetStirFryCount >= 4) vegCount = Math.max(1, Math.floor(targetStirFryCount / 2));

  const slotCats = [
    ...Array(targetStirFryCount - vegCount).fill('小炒'),
    ...Array(vegCount).fill('素菜')
  ];

  for (const cat of slotCats) {
    const chosen = pickWeightedPool(RECIPES.filter(r => r.category === cat && !usedIds.has(r.id)))[0];
    if (chosen) { pickedDishes.push(chosen); usedIds.add(chosen.id); }
  }

  const pickedSoups = pickWeightedPool(RECIPES.filter(r => r.category === '煲汤' && !usedIds.has(r.id))).slice(0, targetSoupCount);

  randomHotpots = pickedHotpots;
  randomDishes = pickedDishes;
  randomSoups = pickedSoups;
  checkedRandomIngs.clear();

  document.getElementById('random-idle').classList.add('hidden');
  document.getElementById('random-result').classList.remove('hidden');
  document.getElementById('random-btn-label').textContent = '重新随机一桌';

  renderRandomResult();
  const tasteObj = TASTES.find(t => t.key === selectedTaste);
  showToast(`已按「${tasteObj.label}」配好 ${formatMealHint(pickedHotpots.length, pickedDishes.length, pickedSoups.length)}`);
}

function swapSingle(type, index) {
  const allIds = new Set([...randomHotpots, ...randomDishes, ...randomSoups].map(r => r.id));
  if (type === 'hotpot') {
    const pool = pickWeightedPool(RECIPES.filter(r => r.category === '火锅' && !allIds.has(r.id)));
    if (!pool.length) return showToast('火锅已全部选完');
    randomHotpots[index] = pool[0];
  } else if (type === 'dish') {
    const curCat = randomDishes[index].category;
    let pool = pickWeightedPool(RECIPES.filter(r => r.category === curCat && !allIds.has(r.id)));
    if (!pool.length) pool = pickWeightedPool(RECIPES.filter(r => (r.category === '小炒' || r.category === '素菜') && !allIds.has(r.id)));
    if (!pool.length) return showToast('炒菜已全部选完');
    randomDishes[index] = pool[0];
  } else {
    const pool = pickWeightedPool(RECIPES.filter(r => r.category === '煲汤' && !allIds.has(r.id)));
    if (!pool.length) return showToast('汤品已全部选完');
    randomSoups[index] = pool[0];
  }
  renderRandomResult();
}

function aggregateIngredients(recipeList) {
  const mainMap = new Map();
  const auxSet = new Set();
  recipeList.forEach(r => {
    r.main.forEach(ing => {
      if (!mainMap.has(ing.name)) mainMap.set(ing.name, { qtys: [], dishes: [] });
      const entry = mainMap.get(ing.name);
      entry.qtys.push(ing.qty);
      entry.dishes.push(r.name);
    });
    r.aux.forEach(ing => auxSet.add(ing.name));
  });
  return {
    main: Array.from(mainMap.entries()).map(([name, info]) => ({
      name,
      qtyText: info.qtys.join(' + '),
      dishes: info.dishes
    })),
    aux: Array.from(auxSet)
  };
}

function renderRandomResult() {
  const tasteObj = TASTES.find(t => t.key === selectedTaste);
  document.getElementById('result-taste-badge').textContent = `偏好：${tasteObj.label}`;

  document.getElementById('result-hotpots').innerHTML = randomHotpots.map((r, idx) => `
    <div class="tint-card row-between" style="padding:12px 14px;">
      <div class="row-center" style="min-width:0; flex:1; cursor:pointer;" onclick="openDetail(${r.id})">
        <span class="tag tag-accent">火锅</span>
        <span class="dish-name" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.name}</span>
        <span class="xxs subtle">${r.minutes}分</span>
      </div>
      <button class="swap-btn" style="background:var(--bg);" onclick="swapSingle('hotpot', ${idx})">换一锅</button>
    </div>
  `).join('');

  document.getElementById('result-dishes').innerHTML = randomDishes.map((r, idx) => `
    <div class="dish-card">
      <div class="row-center" style="min-width:0; flex:1; cursor:pointer;" onclick="openDetail(${r.id})">
        <span class="tag">${r.category}</span>
        <span class="dish-name" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.name}</span>
        <span class="xxs subtle">${r.minutes}分</span>
      </div>
      <button class="swap-btn" onclick="swapSingle('dish', ${idx})">换一道</button>
    </div>
  `).join('');

  document.getElementById('result-soups').innerHTML = randomSoups.map((r, idx) => `
    <div class="dish-card" style="background:var(--surface-alt);">
      <div class="row-center" style="min-width:0; flex:1; cursor:pointer;" onclick="openDetail(${r.id})">
        <span class="tag tag-plain">煲汤</span>
        <span class="dish-name" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.name}</span>
        <span class="xxs subtle">${r.minutes}分</span>
      </div>
      <button class="swap-btn" style="background:var(--bg);" onclick="swapSingle('soup', ${idx})">换一汤</button>
    </div>
  `).join('');

  const allSelected = [...randomHotpots, ...randomDishes, ...randomSoups];
  const { main, aux } = aggregateIngredients(allSelected);
  const doneCount = main.filter(item => checkedRandomIngs.has(item.name)).length;
  document.getElementById('ing-progress-text').textContent = `共 ${main.length} 种主料（已勾选 ${doneCount}/${main.length}）`;

  document.getElementById('random-ing-main').innerHTML = main.map(item => {
    const checked = checkedRandomIngs.has(item.name);
    return `
      <button class="ing-row ${checked ? 'done' : ''}" onclick="toggleRandomIng('${item.name}')">
        <div class="row-center" style="min-width:0;">
          <span class="check-circle ${checked ? 'done' : ''}">
            ${checked ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
          </span>
          <span class="xs ${checked ? 'line-through' : ''}" style="font-weight:500;">${item.name}</span>
          <span class="xxs muted">${item.qtyText}</span>
        </div>
        <span class="xxs subtle" style="max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.dishes.join('、')}</span>
      </button>
    `;
  }).join('');

  document.getElementById('random-ing-aux').innerHTML = aux.map(a => `<span class="tag tag-plain">${a}</span>`).join('');
}

function toggleRandomIng(name) {
  if (checkedRandomIngs.has(name)) checkedRandomIngs.delete(name);
  else checkedRandomIngs.add(name);
  renderRandomResult();
}

function confirmToChecklist() {
  savedIds = new Set([...randomHotpots, ...randomDishes, ...randomSoups].map(r => r.id));
  checkedSavedIngs = new Set(checkedRandomIngs);
  completedDishes.clear();
  completedSteps = {};
  activeCookDishId = null;
  stopTimer();
  persistState();
  updateBadges();
  renderHomeList();
  showToast('已存入「清单」，并排好做菜顺序');
  switchTab('list');
}

/* ==================== TAB 3: 清单 ==================== */
function updateBadges() {
  const badge = document.getElementById('list-badge');
  badge.textContent = savedIds.size;
  badge.classList.toggle('hidden', savedIds.size === 0);
  document.getElementById('cook-dot').classList.toggle('hidden', savedIds.size === 0);
}

function renderSavedTab() {
  const items = getOrderedSavedRecipes();
  const emptyEl = document.getElementById('saved-empty');
  const contentEl = document.getElementById('saved-content');
  const clearBtn = document.getElementById('btn-clear-list');

  if (!items.length) {
    emptyEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
    clearBtn.classList.add('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  contentEl.classList.remove('hidden');
  clearBtn.classList.remove('hidden');

  document.getElementById('saved-dish-count').textContent = `${items.length} 道`;
  document.getElementById('saved-dish-list').innerHTML = items.map((r, idx) => `
    <div class="dish-card" style="padding:10px 14px;">
      <div class="row-center" style="min-width:0; flex:1;" onclick="openDetail(${r.id})">
        <span class="step-num" style="width:22px; height:22px;">${idx + 1}</span>
        <span class="dish-name" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.name}</span>
        <span class="tag">${TIER_META[r.cookTier].short}</span>
      </div>
      <button class="xs subtle" onclick="removeSaved(${r.id})">移除</button>
    </div>
  `).join('');

  const { main, aux } = aggregateIngredients(items);
  const doneCount = main.filter(i => checkedSavedIngs.has(i.name)).length;
  const pct = main.length ? Math.round((doneCount / main.length) * 100) : 0;

  document.getElementById('saved-ing-status').textContent = `已备 ${doneCount} / ${main.length}`;
  document.getElementById('saved-ing-bar').style.width = `${pct}%`;

  if (doneCount === main.length && main.length > 0) {
    document.getElementById('ready-title').textContent = '全部食材已备齐！';
    document.getElementById('ready-sub').textContent = `首道建议先做「${items[0].name}」（${TIER_META[items[0].cookTier].short}）`;
  } else {
    document.getElementById('ready-title').textContent = '食材准备好了？';
    document.getElementById('ready-sub').textContent = `还差 ${main.length - doneCount} 项未勾选，也可随时进入做菜步骤`;
  }

  document.getElementById('saved-ing-main').innerHTML = main.map(item => {
    const checked = checkedSavedIngs.has(item.name);
    return `
      <button class="ing-row ${checked ? 'done' : ''}" onclick="toggleSavedIng('${item.name}')">
        <div class="row-center" style="min-width:0;">
          <span class="check-circle ${checked ? 'done' : ''}">
            ${checked ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
          </span>
          <span class="xs ${checked ? 'line-through' : ''}" style="font-weight:500;">${item.name}</span>
          <span class="xxs muted">${item.qtyText}</span>
        </div>
        <span class="xxs subtle" style="max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.dishes.join('、')}</span>
      </button>
    `;
  }).join('');

  document.getElementById('saved-ing-aux').innerHTML = aux.map(a => `<span class="tag tag-plain">${a}</span>`).join('');
}

function toggleSavedIng(name) {
  if (checkedSavedIngs.has(name)) checkedSavedIngs.delete(name);
  else checkedSavedIngs.add(name);
  persistState();
  renderSavedTab();
}

function removeSaved(id) {
  savedIds.delete(id);
  if (activeCookDishId === id) activeCookDishId = null;
  persistState();
  updateBadges();
  renderSavedTab();
  renderHomeList();
}

function clearSavedMenu() {
  savedIds.clear();
  checkedSavedIngs.clear();
  completedDishes.clear();
  completedSteps = {};
  activeCookDishId = null;
  stopTimer();
  persistState();
  updateBadges();
  renderSavedTab();
  renderHomeList();
  showToast('清单已清空');
}

/* ==================== TAB 4: 做菜 ==================== */
function setStepMode(mode) {
  stepMode = mode;
  document.getElementById('mode-btn-detail').classList.toggle('active', mode === 'detail');
  document.getElementById('mode-btn-brief').classList.toggle('active', mode === 'brief');
  persistState();
  if (activeTab === 'cook') renderCookTab();
  if (currentDetailId && !document.getElementById('detail-overlay').classList.contains('hidden')) {
    openDetail(currentDetailId);
  }
}

function formatTimer(sec) {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

function formatTimerLabel(sec) {
  return sec < 60 ? `${sec} 秒` : `${Math.round(sec / 60)} 分钟`;
}

function stopTimer() {
  if (timerState.intervalId) clearInterval(timerState.intervalId);
  timerState = { key: null, remaining: 0, intervalId: null };
}

function triggerStepTimer(e, key, seconds) {
  e.stopPropagation();
  if (timerState.key === key) {
    stopTimer();
    showToast('已停止倒计时');
    renderCookTab();
    return;
  }
  stopTimer();
  timerState.key = key;
  timerState.remaining = seconds;
  showToast(`开始倒计时：${formatTimerLabel(seconds)}`);
  renderCookTab();
  timerState.intervalId = setInterval(() => {
    timerState.remaining -= 1;
    if (timerState.remaining <= 0) {
      stopTimer();
      showToast('计时结束！请查看锅中火候');
    }
    if (activeTab === 'cook') renderCookTab();
  }, 1000);
}

function renderCookTab() {
  const dishes = getOrderedSavedRecipes();
  const emptyEl = document.getElementById('cook-empty');
  const contentEl = document.getElementById('cook-content');

  if (!dishes.length) {
    emptyEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  contentEl.classList.remove('hidden');

  if (!activeCookDishId || !savedIds.has(activeCookDishId)) activeCookDishId = dishes[0].id;

  const doneCount = dishes.filter(d => completedDishes.has(d.id)).length;
  document.getElementById('cook-overall-badge').textContent = `已完成 ${doneCount} / ${dishes.length} 道`;
  document.getElementById('cook-flow-summary').textContent = buildFlowSummary(dishes);

  document.getElementById('cook-dish-tabs').innerHTML = dishes.map((d, idx) => {
    const isActive = d.id === activeCookDishId;
    const isDone = completedDishes.has(d.id);
    return `
      <button class="cook-dish-pill ${isActive ? 'active' : ''}" onclick="selectCookDish(${d.id})">
        ${isDone
          ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><polyline points="20 6 9 17 4 12"/></svg>'
          : `<span style="opacity:0.65;">${idx + 1}.</span>`
        }
        <span>${d.name}</span>
      </button>
    `;
  }).join('');

  const activeDish = dishes.find(d => d.id === activeCookDishId) || dishes[0];
  if (!completedSteps[activeDish.id]) completedSteps[activeDish.id] = new Set();
  const doneSet = completedSteps[activeDish.id];

  document.getElementById('cook-dish-stage').textContent = TIER_META[activeDish.cookTier].tag;
  document.getElementById('cook-dish-cat').textContent = activeDish.category;
  document.getElementById('cook-dish-time').textContent = `${activeDish.minutes} 分钟`;
  document.getElementById('cook-dish-title').textContent = activeDish.name;
  document.getElementById('cook-step-counter').textContent = `步骤 ${doneSet.size}/${activeDish.steps.length}`;

  document.getElementById('cook-dish-ings').innerHTML = [
    ...activeDish.main.map(i => `<span class="tag tag-plain" style="color:var(--text);">${i.name} ${i.qty}</span>`),
    ...activeDish.aux.map(i => `<span class="tag tag-plain">${i.name} ${i.qty}</span>`)
  ].join('');

  document.getElementById('step-mode-hint').textContent = stepMode === 'detail'
    ? '精细描述：含火候、用量与避坑贴士'
    : '精简描述：一句话速览，适合熟手快看';

  document.getElementById('cook-steps-list').innerHTML = activeDish.steps.map((s, idx) => {
    const isDone = doneSet.has(idx);
    const timerKey = `${activeDish.id}-${idx}`;
    const isRunning = timerState.key === timerKey;
    const bodyText = stepMode === 'detail' ? s.detail : s.brief;

    return `
      <div class="step-card ${isDone ? 'done' : ''}" onclick="toggleCookStep(${activeDish.id}, ${idx})">
        <div style="display:flex; align-items:flex-start; gap:12px;">
          <div class="step-num ${isDone ? 'done' : ''}">
            ${isDone ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><polyline points="20 6 9 17 4 12"/></svg>' : idx + 1}
          </div>
          <div style="flex:1; min-width:0;">
            <div class="row-between">
              <span class="xs ${isDone ? 'line-through muted' : ''}" style="font-weight:600;">${s.title}</span>
              ${s.timerSec ? `
                <button class="timer-btn ${isRunning ? 'running' : ''}" onclick="triggerStepTimer(event, '${timerKey}', ${s.timerSec})">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>${isRunning ? formatTimer(timerState.remaining) : formatTimerLabel(s.timerSec)}</span>
                </button>
              ` : ''}
            </div>
            <p class="xs muted ${isDone ? 'line-through' : ''}" style="margin:6px 0 0; line-height:1.65;">${bodyText}</p>
            ${stepMode === 'detail' && s.tip && !isDone ? `<div class="tip-box"><strong style="color:var(--text);">贴士：</strong>${s.tip}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  const curIdx = dishes.findIndex(d => d.id === activeDish.id);
  document.getElementById('cook-prev-btn').style.opacity = curIdx === 0 ? '0.4' : '1';

  const completeBtn = document.getElementById('cook-complete-btn');
  const isDishDone = completedDishes.has(activeDish.id);
  if (isDishDone && curIdx < dishes.length - 1) completeBtn.textContent = `已完成 · 去做下一道（${dishes[curIdx + 1].name}）`;
  else if (isDishDone) completeBtn.textContent = '本餐全部做好啦 · 开饭！';
  else if (curIdx < dishes.length - 1) completeBtn.textContent = `做好了 → 下一道（${dishes[curIdx + 1].name}）`;
  else completeBtn.textContent = '完成最后一道菜';
}

function selectCookDish(id) {
  activeCookDishId = id;
  renderCookTab();
  document.getElementById('main-scroll').scrollTop = 0;
}

function toggleCookStep(dishId, stepIdx) {
  if (!completedSteps[dishId]) completedSteps[dishId] = new Set();
  const set = completedSteps[dishId];
  if (set.has(stepIdx)) set.delete(stepIdx);
  else set.add(stepIdx);
  const dish = RECIPES.find(r => r.id === dishId);
  if (dish && set.size === dish.steps.length) completedDishes.add(dishId);
  else completedDishes.delete(dishId);
  persistState();
  renderCookTab();
}

function cookNextDish(delta) {
  const dishes = getOrderedSavedRecipes();
  const next = dishes.findIndex(d => d.id === activeCookDishId) + delta;
  if (next >= 0 && next < dishes.length) {
    activeCookDishId = dishes[next].id;
    renderCookTab();
    document.getElementById('main-scroll').scrollTop = 0;
  }
}

function completeCurrentDish() {
  const dishes = getOrderedSavedRecipes();
  const idx = dishes.findIndex(d => d.id === activeCookDishId);
  const dish = dishes[idx];
  if (!dish) return;
  completedDishes.add(dish.id);
  completedSteps[dish.id] = new Set(dish.steps.map((_, i) => i));
  if (idx < dishes.length - 1) {
    activeCookDishId = dishes[idx + 1].id;
    showToast(`「${dish.name}」完成，切换下一道`);
  } else {
    showToast('本餐全部做好啦，开饭！');
  }
  persistState();
  renderCookTab();
  document.getElementById('main-scroll').scrollTop = 0;
}

/* ==================== DETAIL DRAWER ==================== */
function openDetail(id) {
  currentDetailId = id;
  const r = RECIPES.find(item => item.id === id);
  if (!r) return;

  document.getElementById('detail-body').innerHTML = `
    <div class="row-between" style="align-items:flex-start;">
      <div>
        <div class="pill-wrap" style="gap:6px;">
          <span class="tag">${r.category}</span>
          <span class="tag tag-plain">${TIER_META[r.cookTier].short}</span>
          <span class="xs muted">${r.minutes} 分钟</span>
        </div>
        <div style="font-size:18px; font-weight:600; margin-top:8px;">${r.name}</div>
      </div>
      <div class="seg-switch" style="flex-shrink:0;">
        <button class="seg-btn ${stepMode === 'detail' ? 'active' : ''}" onclick="setStepMode('detail')">精细</button>
        <button class="seg-btn ${stepMode === 'brief' ? 'active' : ''}" onclick="setStepMode('brief')">精简</button>
      </div>
    </div>

    <div class="surface-card stack-8" style="padding:14px;">
      <div class="section-title">主料与调味</div>
      <div class="pill-wrap" style="gap:6px;">
        ${r.main.map(i => `<span class="tag tag-plain" style="color:var(--text);">${i.name} ${i.qty}</span>`).join('')}
        ${r.aux.map(i => `<span class="tag tag-plain">${i.name} ${i.qty}</span>`).join('')}
      </div>
    </div>

    <div class="stack-10">
      <div class="section-title">做法步骤（${stepMode === 'detail' ? '精细描述' : '精简描述'}）</div>
      ${r.steps.map((s, idx) => `
        <div class="white-card" style="background:var(--surface-alt); padding:12px;">
          <div class="row-center">
            <span class="step-num" style="width:20px; height:20px;">${idx + 1}</span>
            <span class="xs" style="font-weight:600;">${s.title}</span>
          </div>
          <p class="xs muted" style="margin:6px 0 0 28px; line-height:1.6;">${stepMode === 'detail' ? s.detail : s.brief}</p>
          ${stepMode === 'detail' && s.tip ? `<div class="xxs muted" style="margin:6px 0 0 28px;"><strong style="color:var(--text);">贴士：</strong>${s.tip}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;

  updateDetailBtn();
  document.getElementById('detail-overlay').classList.remove('hidden');
}

function updateDetailBtn() {
  const btn = document.getElementById('detail-toggle-btn');
  if (savedIds.has(currentDetailId)) {
    btn.textContent = '已在备菜清单 · 点击移出';
    btn.style.background = 'var(--surface)';
    btn.style.color = 'var(--text)';
    btn.style.border = '1px solid var(--border)';
  } else {
    btn.textContent = '加入备菜清单';
    btn.style.background = 'var(--accent)';
    btn.style.color = 'var(--accent-fg)';
    btn.style.border = 'none';
  }
}

function toggleSavedFromDetail() {
  if (savedIds.has(currentDetailId)) {
    savedIds.delete(currentDetailId);
    showToast('已移出备菜清单');
  } else {
    savedIds.add(currentDetailId);
    showToast('已加入备菜清单');
  }
  persistState();
  updateDetailBtn();
  updateBadges();
  renderHomeList();
  if (activeTab === 'list') renderSavedTab();
  if (activeTab === 'cook') renderCookTab();
}

function closeDetail(e) {
  if (e && e.target !== document.getElementById('detail-overlay')) return;
  document.getElementById('detail-overlay').classList.add('hidden');
}

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// Register offline service worker (for PWA / Safari Add to Home Screen)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// Init
hydrateState();
document.getElementById('mode-btn-detail').classList.toggle('active', stepMode === 'detail');
document.getElementById('mode-btn-brief').classList.toggle('active', stepMode === 'brief');
renderCategoryGrid();
renderHomeList();
renderRandomControls();
updateBadges();
