/* ───────────────────────────────────────────────────────
   FinTrack — app.js
   Core data layer, utilities, and PWA registration
─────────────────────────────────────────────────────── */

'use strict';

/* ══════════════════════════════════════════════════════
   DATABASE (localStorage wrapper)
══════════════════════════════════════════════════════ */
const DB = {
  TX_KEY: 'fintrack_v1_transactions',

  // ── Transactions ─────────────────────────────
  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.TX_KEY)) || [];
    } catch {
      return [];
    }
  },

  _save(list) {
    localStorage.setItem(this.TX_KEY, JSON.stringify(list));
  },

  add(tx) {
    const list = this.getAll();
    const record = {
      id:       'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      type:     tx.type,
      category: tx.category,
      amount:   parseFloat(tx.amount),
      note:     (tx.note || '').trim().slice(0, 120),
      date:     tx.date || today(),
      createdAt: new Date().toISOString(),
    };
    list.unshift(record);
    this._save(list);
    return record;
  },

  remove(id) {
    this._save(this.getAll().filter(t => t.id !== id));
  },

  clearAll() {
    localStorage.removeItem(this.TX_KEY);
  },

  summary() {
    const list = this.getAll();
    const income   = list.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = list.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { income, expenses, balance: income - expenses };
  },

  // ── Food Logs ────────────────────────────────
  _foodKey(date) { return `fintrack_v1_food_${date}`; },

  getFood(date) {
    try {
      return JSON.parse(localStorage.getItem(this._foodKey(date)))
        || { breakfast: 0, lunch: 0, dinner: 0 };
    } catch {
      return { breakfast: 0, lunch: 0, dinner: 0 };
    }
  },

  saveFood(date, log) {
    localStorage.setItem(this._foodKey(date), JSON.stringify({
      breakfast: Math.max(0, log.breakfast || 0),
      lunch:     Math.max(0, log.lunch     || 0),
      dinner:    Math.max(0, log.dinner    || 0),
    }));
  },

  resetFood(date) {
    localStorage.removeItem(this._foodKey(date));
  },

  resetFoodWeek() {
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      localStorage.removeItem(this._foodKey(d.toISOString().split('T')[0]));
    }
  },

  getFoodHistory(days = 7) {
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = d.toISOString().split('T')[0];
      out.push({ date, ...this.getFood(date) });
    }
    return out;
  },

  getFoodTotal() {
    const total = { breakfast: 0, lunch: 0, dinner: 0 };
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('fintrack_v1_food_')) {
        try {
          const log = JSON.parse(localStorage.getItem(key));
          total.breakfast += (log.breakfast || 0);
          total.lunch     += (log.lunch     || 0);
          total.dinner    += (log.dinner    || 0);
        } catch (e) {}
      }
    }
    return total;
  },

  // ── Import / Export ──────────────────────────
  exportData() {
    const data = {
      transactions: this.getAll(),
      food: {}
    };
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('fintrack_v1_food_')) {
        try {
          data.food[key] = JSON.parse(localStorage.getItem(key));
        } catch (e) {}
      }
    }
    return JSON.stringify(data, null, 2);
  },

  importData(jsonData) {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      if (data.transactions && Array.isArray(data.transactions)) {
        this._save(data.transactions);
      }
      if (data.food && typeof data.food === 'object') {
        for (const [key, value] of Object.entries(data.food)) {
          if (key.startsWith('fintrack_v1_food_')) {
            localStorage.setItem(key, JSON.stringify(value));
          }
        }
      }
      return true;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  },

  // ── Goals ───────────────────────────────────
  _goalsKey: 'fintrack_v1_goals',

  getGoals() {
    try { return JSON.parse(localStorage.getItem(this._goalsKey)) || []; }
    catch { return []; }
  },

  saveGoals(goals) {
    localStorage.setItem(this._goalsKey, JSON.stringify(goals));
  },

  addGoal(goal) {
    const goals = this.getGoals();
    goals.push({
      id: 'goal_' + Date.now(),
      name: goal.name || 'New Goal',
      target: parseFloat(goal.target) || 0,
      current: parseFloat(goal.current) || 0,
      color: goal.color || 'var(--teal)',
      icon: goal.icon || '🎯',
      createdAt: new Date().toISOString()
    });
    this.saveGoals(goals);
    return goals;
  },

  updateGoal(id, current) {
    const goals = this.getGoals();
    const g = goals.find(g => g.id === id);
    if (g) { g.current = Math.max(0, parseFloat(current) || 0); }
    this.saveGoals(goals);
    return goals;
  },

  deleteGoal(id) {
    this.saveGoals(this.getGoals().filter(g => g.id !== id));
  },

  // ── Budget ──────────────────────────────────
  _budgetKey() {
    return `fintrack_v1_budget_${new Date().getFullYear()}_${new Date().getMonth() + 1}`;
  },

  getBudget() {
    try { return JSON.parse(localStorage.getItem(this._budgetKey())) || { limit: 6000 }; }
    catch { return { limit: 6000 }; }
  },

  setBudget(limit) {
    localStorage.setItem(this._budgetKey(), JSON.stringify({ limit: parseFloat(limit) || 6000 }));
  },

  // ── Streaks ──────────────────────────────────
  getMealStreak() {
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = d.toISOString().split('T')[0];
      const log = this.getFood(date);
      const hasAny = (log.breakfast > 0) || (log.lunch > 0) || (log.dinner > 0);
      if (hasAny) streak++;
      else break;
    }
    return streak;
  },

  getMealConsistency(days = 30) {
    let loggedDays = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = d.toISOString().split('T')[0];
      const log = this.getFood(date);
      if ((log.breakfast > 0) || (log.lunch > 0) || (log.dinner > 0)) loggedDays++;
    }
    return Math.round((loggedDays / days) * 100);
  },

  // ── Category Breakdown ──────────────────────
  getCategoryBreakdown() {
    const list = this.getAll();
    const cats = {};
    let totalExpense = 0;
    list.filter(t => t.type === 'expense').forEach(t => {
      cats[t.category] = (cats[t.category] || 0) + t.amount;
      totalExpense += t.amount;
    });
    const colors = {
      'Food / Dining': 'var(--amber)',
      'Room Rent': 'var(--violet)',
      'Transport': 'var(--blue)',
      'Shopping': 'var(--rose)',
      'Entertainment': '#f472b6',
      'Medicine': '#f87171',
      'Wi-Fi': 'var(--teal)',
      'Water Bill': '#38bdf8',
      'Other': '#94a3b8'
    };
    return Object.entries(cats)
      .map(([name, amount]) => ({
        name,
        amount,
        pct: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
        color: colors[name] || 'var(--teal)'
      }))
      .sort((a, b) => b.amount - a.amount);
  },

  // ── Weekly Spending ─────────────────────────
  getWeeklySpending() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = d.toISOString().split('T')[0];
      const dayTotal = this.getAll()
        .filter(t => t.date === date && t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0);
      days.push({
        date,
        label: d.toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 3),
        amount: dayTotal
      });
    }
    return days;
  },

  // ── Monthly Comparison ──────────────────────
  getMonthlyComparison() {
    const now = new Date();
    const thisMonth = now.getMonth();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const thisYear = now.getFullYear();
    const lastYear = thisMonth === 0 ? thisYear - 1 : thisYear;

    const list = this.getAll();
    const thisMonthTxns = list.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });
    const lastMonthTxns = list.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === lastMonth && d.getFullYear() === lastYear;
    });

    const thisIncome = thisMonthTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const thisExpenses = thisMonthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const lastIncome = lastMonthTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const lastExpenses = lastMonthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    const thisSavings = thisIncome - thisExpenses;
    const lastSavings = lastIncome - lastExpenses;

    return {
      incomeChange: lastIncome > 0 ? Math.round(((thisIncome - lastIncome) / lastIncome) * 100) : 0,
      expenseChange: lastExpenses > 0 ? Math.round(((thisExpenses - lastExpenses) / lastExpenses) * 100) : 0,
      savingsChange: lastSavings > 0 ? Math.round(((thisSavings - lastSavings) / lastSavings) * 100) : (thisSavings > 0 ? 100 : 0),
      savingsRate: thisIncome > 0 ? Math.round((thisSavings / thisIncome) * 100) : 0,
      thisMonth: { income: thisIncome, expenses: thisExpenses, savings: thisSavings },
      lastMonth: { income: lastIncome, expenses: lastExpenses, savings: lastSavings }
    };
  },

  // ── Financial Health Score ──────────────────
  getHealthScore() {
    const cmpr = this.getMonthlyComparison();
    const { savingsRate, savingsChange, expenseChange } = cmpr;
    let score = 50;
    // Savings rate: 0% → -20, 50%+ → +25
    score += Math.min(savingsRate * 0.5, 25);
    // Savings trend
    if (savingsChange > 0) score += Math.min(savingsChange * 0.2, 15);
    else score += Math.max(savingsChange * 0.3, -15);
    // Expense trend (lower = better)
    if (expenseChange < 0) score += Math.min(Math.abs(expenseChange) * 0.15, 10);
    else score -= Math.min(expenseChange * 0.2, 10);
    return Math.max(0, Math.min(100, Math.round(score)));
  },

  // ── Smart Insights ──────────────────────────
  getInsights() {
    const insights = [];
    const breakdown = this.getCategoryBreakdown();
    const weekly = this.getWeeklySpending();
    const cmpr = this.getMonthlyComparison();
    const goals = this.getGoals();

    // Top spending category
    if (breakdown.length > 0) {
      insights.push({
        icon: '📊',
        bg: 'var(--amber-dim)',
        text: `Your biggest spending this month is <b>${breakdown[0].name}</b> (${breakdown[0].pct}%).`
      });
    }

    // Weekly trend
    const weekTotal = weekly.reduce((s, d) => s + d.amount, 0);
    const midWeek = weekly.slice(0, 4).reduce((s, d) => s + d.amount, 0);
    const endWeek = weekly.slice(4).reduce((s, d) => s + d.amount, 0);
    if (endWeek < midWeek && weekTotal > 0) {
      insights.push({
        icon: '📉',
        bg: 'var(--green-dim)',
        text: `You spent <b>${Math.round((1 - endWeek/midWeek) * 100)}% less</b> in the last 3 days compared to earlier this week.`
      });
    }

    // Savings trend
    if (cmpr.savingsChange > 5) {
      insights.push({
        icon: '🚀',
        bg: 'var(--teal-dim)',
        text: `Your savings are up <b>${cmpr.savingsChange}%</b> compared to last month. Keep it up!`
      });
    } else if (cmpr.savingsChange < -5) {
      insights.push({
        icon: '⚠️',
        bg: 'var(--rose-dim)',
        text: `Your savings dropped <b>${Math.abs(cmpr.savingsChange)}%</b> vs last month. Watch your spending.`
      });
    }

    // Goal tracking
    goals.forEach(g => {
      if (g.target > 0 && g.current < g.target) {
        const pct = Math.round((g.current / g.target) * 100);
        insights.push({
          icon: g.icon,
          bg: g.color.replace(')', ',0.10)') || 'var(--teal-dim)',
          text: `<b>${g.name}</b>: ${pct}% done. You need ₹${Math.abs(g.target - g.current).toLocaleString('en-IN')} more.`
        });
      }
    });

    return insights.slice(0, 4);
  },
  hasPwd() {
    return !!localStorage.getItem('fintrack_v1_pwd');
  },
  checkPwd(pwd) {
    // Basic encoding to avoid plain-text in localStorage
    return localStorage.getItem('fintrack_v1_pwd') === btoa(pwd);
  },
  setPwd(pwd) {
    localStorage.setItem('fintrack_v1_pwd', btoa(pwd));
  },
  removePwd() {
    localStorage.removeItem('fintrack_v1_pwd');
  },
  wipeAllData() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('fintrack_v1_')) {
        keys.push(k);
      }
    }
    keys.forEach(k => localStorage.removeItem(k));
  }
};

/* ══════════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════════ */

/** Returns today's date as YYYY-MM-DD */
function today() {
  return new Date().toISOString().split('T')[0];
}

/** Format number as ₹ Indian currency */
function rupees(n) {
  const num = Number(n) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

/** Format YYYY-MM-DD as "12 Jun 2026" */
function fmtDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

/** Format YYYY-MM-DD as short day "Mon" */
function fmtDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 3);
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Icon emoji per category */
const ICONS = {
  'Salary/Stipend': '💼',
  'Freelance':      '💻',
  'Gift':           '🎁',
  'Other Income':   '💰',
  'Room Rent':      '🏠',
  'Water Bill':     '💧',
  'Wi-Fi':          '📡',
  'Transport':      '🚇',
  'Food / Dining':  '🍜',
  'Shopping':       '🛍️',
  'Medicine':       '💊',
  'Entertainment':  '🎬',
  'Other':          '📦',
};

function icon(category) {
  return ICONS[category] || '💳';
}

/* ══════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
══════════════════════════════════════════════════════ */
let _toastTimer;

function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  if (!el) return;
  clearTimeout(_toastTimer);
  el.textContent = msg;
  el.className = `toast ${type} show`;
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

/* ══════════════════════════════════════════════════════
   ACTIVE NAV HIGHLIGHT
══════════════════════════════════════════════════════ */
function setActiveNav() {
  const filename = location.pathname.split('/').pop() || 'index.html';
  const page     = filename.replace('.html', '') || 'index';
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.classList.toggle('active', el.dataset.nav === page);
  });
}

document.addEventListener('DOMContentLoaded', setActiveNav);

/* ══════════════════════════════════════════════════════
   BUILD TRANSACTION HTML (reused in multiple pages)
══════════════════════════════════════════════════════ */
function txHTML(tx, { deletable = false } = {}) {
  const isIncome = tx.type === 'income';
  const sign     = isIncome ? '+' : '−';
  const clr      = isIncome ? 'var(--green)' : 'var(--rose)';
  const bg       = isIncome ? 'var(--green-dim)' : 'var(--rose-dim)';
  const del      = deletable
    ? `<button class="del-btn" onclick="deleteTx('${tx.id}')" title="Delete">
         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
           <polyline points="3 6 5 6 21 6"/>
           <path d="M19 6l-1 14H6L5 6"/>
           <path d="M10 11v6M14 11v6"/>
           <path d="M9 6V4h6v2"/>
         </svg>
       </button>`
    : '';

  return `
    <div class="tx-item" id="tx-${tx.id}">
      <div class="tx-icon" style="background:${bg}">
        <span>${icon(tx.category)}</span>
      </div>
      <div style="flex:1;min-width:0;">
        <p style="font-size:14px;font-weight:600;color:var(--text);
                  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
                  margin:0 0 2px">${escHtml(tx.category)}</p>
        <p style="font-size:12px;color:var(--text-mute);margin:0">
          ${fmtDate(tx.date)}${tx.note ? ' · ' + escHtml(tx.note) : ''}
        </p>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
        <span style="font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:${clr}">
          ${sign}${rupees(tx.amount)}
        </span>
        ${del}
      </div>
    </div>`;
}

/** Simple XSS protection */
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ══════════════════════════════════════════════════════
   SERVICE WORKER REGISTRATION
══════════════════════════════════════════════════════ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // If we're on localhost, don't use the service worker to avoid caching issues during development
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
          registration.unregister();
        }
      });
      console.log('[SW] Unregistered for development');
      return;
    }

    navigator.serviceWorker.register('service-worker.js')
      .then(reg => {
        console.log('[SW] Registered:', reg.scope);

        const banner = document.getElementById('update-banner');
        const btn = document.getElementById('update-btn');
        if (!banner || !btn) return;

        const notify = (worker) => {
          banner.classList.add('show');
          btn.onclick = () => {
            worker.postMessage('SKIP_WAITING');
            banner.classList.remove('show');
            // Force hide fallback just in case
            setTimeout(() => { banner.style.display = 'none'; }, 500);
          };
        };

        // 1. If there's already a worker waiting (from previous visit)
        if (reg.waiting) notify(reg.waiting);

        // 2. If a worker arrives while page is open
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (!installingWorker) return;
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              notify(installingWorker);
            }
          };
        };
      })
      .catch(e => console.warn('[SW] Registration failed:', e));

    // Listen for the controlling SW to change (meaning skipWaiting was called)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        window.location.reload();
        refreshing = true;
      }
    });
  });
}
