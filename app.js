/* ============================================
   OPTIMIZED APP.JS - Invoice Manager
   ============================================ */

// ============================================
// 1. Configuration & State
// ============================================
const CONFIG = {
  SUPABASE_URL: 'https://kgdewraoanlaqewpbdlo.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnZGV3cmFvYW5sYXFld3BiZGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3MTg3NDksImV4cCI6MjA2OTI5NDc0OX0.wBgDDHcdK0Q9mN6uEPQFEO8gXiJdnrntLJW3dUdh89M',
  AUTH_TIMEOUT: 24, // hours
  CURRENCY: '₹',
  DATE_FORMAT: 'en-IN'
};

// Global State
const state = {
  supabase: null,
  currentPage: 'dashboard',
  data: {
    invoices: [],
    clients: [],
    expenses: [],
    settings: {
      currency: 'INR',
      taxRate: 0,
      invoicePrefix: 'HP-2526',
      profileName: 'Hariprasad Sivakumar',
      gstin: '',
      pan: '',
      email: '',
      phone: '',
      address: '',
      bankName: '',
      accountNumber: '',
      ifsc: '',
      upiId: ''
    }
  },
  filters: {
    invoices: {
      status: 'all',
      client: 'all',
      dateRange: { from: null, to: null },
      amountRange: { min: null, max: null },
      search: '',
      sortBy: 'date',
      sortOrder: 'desc'
    },
    clients: {
      search: '',
      hasInvoices: 'all',
      sortBy: 'name',
      sortOrder: 'asc'
    },
    expenses: {
      category: 'all',
      dateRange: { from: null, to: null },
      amountRange: { min: null, max: null },
      search: '',
      taxDeductible: 'all'
    },
    global: {
      dateRange: { from: null, to: null }
    }
  },
  ui: {
    modalOpen: false,
    loading: false,
    searchQuery: '',
    advancedFiltersOpen: false
  }
};

// ============================================
// 2. Utility Functions
// ============================================
const utils = {
  // Format currency
  formatCurrency: (amount) => {
    return `${CONFIG.CURRENCY}${amount.toLocaleString('en-IN')}`;
  },

  // Format date
  formatDate: (date) => {
    return new Date(date).toLocaleDateString(CONFIG.DATE_FORMAT, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  // Generate unique ID
  generateId: () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  // Debounce function
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Show toast notification
  showToast: (message, type = 'info', duration = 3000) => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
      <span class="toast-message">${message}</span>
    `;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // Show loading
  showLoading: (show = true) => {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.classList.toggle('active', show);
    }
    state.ui.loading = show;
  },

  // Validate email
  validateEmail: (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  // Validate GSTIN
  validateGSTIN: (gstin) => {
    return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin);
  },

  // Calculate tax
  calculateTax: (amount, rate) => {
    return amount * (rate / 100);
  },

  // Get status color
  getStatusColor: (status) => {
    const colors = {
      paid: 'success',
      pending: 'warning',
      overdue: 'danger',
      draft: 'secondary'
    };
    return colors[status.toLowerCase()] || 'secondary';
  }
};

// ============================================
// 3. Authentication
// ============================================
const auth = {
  check: () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const loginTime = localStorage.getItem('loginTime');
    
    if (!isLoggedIn || isLoggedIn !== 'true') {
      return false;
    }
    
    if (loginTime) {
      const hoursDiff = (Date.now() - parseInt(loginTime)) / (1000 * 60 * 60);
      if (hoursDiff > CONFIG.AUTH_TIMEOUT) {
        auth.logout();
        return false;
      }
    }
    
    return true;
  },

  logout: () => {
    ['isLoggedIn', 'username', 'loginTime'].forEach(key => localStorage.removeItem(key));
    window.location.href = 'login.html';
  }
};

// Global logout function
window.logout = auth.logout;

// ============================================
// 4. Supabase Integration
// ============================================
const database = {
  init: async () => {
    try {
      if (window.supabase) {
        state.supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
        console.log('✅ Supabase initialized');
        return true;
      }
    } catch (error) {
      console.error('❌ Supabase init failed:', error);
      return false;
    }
  },

  // Load all data
  loadData: async () => {
    if (!state.supabase) return;
    
    utils.showLoading(true);
    
    try {
      // Load invoices
      const { data: invoices } = await state.supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (invoices) state.data.invoices = invoices;

      // Load clients
      const { data: clients } = await state.supabase
        .from('clients')
        .select('*')
        .order('name');
      
      if (clients) state.data.clients = clients;

      // Load expenses
      const { data: expenses } = await state.supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });
      
      if (expenses) state.data.expenses = expenses;

      // Load settings
      const { data: settings } = await state.supabase
        .from('settings')
        .select('*')
        .eq('user_id', 'default')
        .single();
      
      if (settings) {
        state.data.settings = { ...state.data.settings, ...settings };
      }

      console.log('✅ Data loaded successfully');
    } catch (error) {
      console.error('❌ Error loading data:', error);
      utils.showToast('Error loading data', 'error');
    } finally {
      utils.showLoading(false);
    }
  },

  // Save invoice
  saveInvoice: async (invoice) => {
    if (!state.supabase) return null;
    
    try {
      const { data, error } = await state.supabase
        .from('invoices')
        .upsert(invoice)
        .select()
        .single();
      
      if (error) throw error;
      
      // Update local state
      const index = state.data.invoices.findIndex(i => i.id === invoice.id);
      if (index >= 0) {
        state.data.invoices[index] = data;
      } else {
        state.data.invoices.unshift(data);
      }
      
      return data;
    } catch (error) {
      console.error('Error saving invoice:', error);
      throw error;
    }
  },

  // Save client
  saveClient: async (client) => {
    if (!state.supabase) return null;
    
    try {
      const { data, error } = await state.supabase
        .from('clients')
        .upsert(client)
        .select()
        .single();
      
      if (error) throw error;
      
      // Update local state
      const index = state.data.clients.findIndex(c => c.id === client.id);
      if (index >= 0) {
        state.data.clients[index] = data;
      } else {
        state.data.clients.push(data);
      }
      
      return data;
    } catch (error) {
      console.error('Error saving client:', error);
      throw error;
    }
  },

  // Delete invoice
  deleteInvoice: async (id) => {
    if (!state.supabase) return false;
    
    try {
      const { error } = await state.supabase
        .from('invoices')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // Update local state
      state.data.invoices = state.data.invoices.filter(i => i.id !== id);
      
      return true;
    } catch (error) {
      console.error('Error deleting invoice:', error);
      throw error;
    }
  },

  // Delete client
  deleteClient: async (id) => {
    if (!state.supabase) return false;
    
    try {
      const { error } = await state.supabase
        .from('clients')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // Update local state
      state.data.clients = state.data.clients.filter(c => c.id !== id);
      
      return true;
    } catch (error) {
      console.error('Error deleting client:', error);
      throw error;
    }
  },

  // Save settings
  saveSettings: async (settings) => {
    if (!state.supabase) return null;
    
    try {
      const { data, error } = await state.supabase
        .from('settings')
        .upsert({ ...settings, user_id: 'default' })
        .select()
        .single();
      
      if (error) throw error;
      
      state.data.settings = { ...state.data.settings, ...data };
      
      return data;
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }
};

// ============================================
// 5. UI Components
// ============================================
const components = {
  // Render stat card
  statCard: (icon, value, label) => `
    <div class="stat-card">
      <div class="stat-icon">${icon}</div>
      <div class="stat-content">
        <h3>${value}</h3>
        <p>${label}</p>
      </div>
    </div>
  `,

  // Render table row
  tableRow: (cells, actions = '') => `
    <tr>
      ${cells.map(cell => `<td>${cell}</td>`).join('')}
      ${actions ? `<td>${actions}</td>` : ''}
    </tr>
  `,

  // Render status badge
  statusBadge: (status) => `
    <span class="status-badge ${status.toLowerCase()}">${status}</span>
  `,

  // Render action buttons
  actionButtons: (actions) => {
    return actions.map(action => `
      <button class="btn btn-icon btn-sm" onclick="${action.handler}" title="${action.title}">
        ${action.icon}
      </button>
    `).join('');
  },

  // Render client card
  clientCard: (client) => `
    <div class="client-card" data-id="${client.id}">
      <div class="flex-between mb-md">
        <h3>${client.name}</h3>
        <div class="flex gap-sm">
          <button class="btn btn-icon btn-sm" onclick="ui.editClient('${client.id}')" title="Edit">✏️</button>
          <button class="btn btn-icon btn-sm" onclick="ui.deleteClient('${client.id}')" title="Delete">🗑️</button>
        </div>
      </div>
      <p class="text-muted">${client.email || 'No email'}</p>
      <p class="text-muted">${client.phone || 'No phone'}</p>
      <div class="flex-between mt-md">
        <span>${state.data.invoices.filter(i => i.clientId === client.id).length} invoices</span>
        <span class="text-success">${utils.formatCurrency(client.total_amount || 0)}</span>
      </div>
    </div>
  `,

  // Render modal
  modal: (title, content, footer = '') => `
    <div class="modal-overlay" onclick="ui.closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2 class="modal-title">${title}</h2>
          <button class="modal-close" onclick="ui.closeModal()">×</button>
        </div>
        <div class="modal-body">${content}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    </div>
  `
};

// ============================================
// 6. Page Renderers
// ============================================
const pages = {
  // Render Dashboard
  dashboard: () => {
    const totalEarnings = state.data.invoices
      .filter(i => i.status === 'Paid')
      .reduce((sum, i) => sum + i.amount, 0);
    
    const pendingAmount = state.data.invoices
      .filter(i => i.status === 'Pending')
      .reduce((sum, i) => sum + i.amount, 0);
    
    const statsHtml = `
      ${components.statCard('💵', utils.formatCurrency(totalEarnings), 'Total Earnings')}
      ${components.statCard('📄', state.data.invoices.length, 'Total Invoices')}
      ${components.statCard('👥', state.data.clients.length, 'Total Clients')}
      ${components.statCard('⏳', utils.formatCurrency(pendingAmount), 'Pending Amount')}
    `;
    
    document.querySelector('.stats-row').innerHTML = statsHtml;
    
    // Render charts
    charts.renderMonthlyRevenue();
    charts.renderInvoiceStatus();
    
    // Render recent invoices
    const recentInvoices = state.data.invoices.slice(0, 5);
    const recentHtml = recentInvoices.map(invoice => `
      <div class="activity-item">
        <div>
          <strong>${invoice.invoiceNumber}</strong>
          <span class="text-muted">${invoice.client}</span>
        </div>
        <div class="text-right">
          <div>${utils.formatCurrency(invoice.amount)}</div>
          ${components.statusBadge(invoice.status)}
        </div>
      </div>
    `).join('');
    
    document.getElementById('recent-invoices').innerHTML = recentHtml || '<p class="text-muted text-center">No invoices yet</p>';
  },

  // Render Invoices
  invoices: () => {
    const tbody = document.getElementById('invoices-tbody');
    if (!tbody) return;
    
    // Apply advanced filters
    let filteredInvoices = filters.applyInvoiceFilters(state.data.invoices);
    
    // Generate table rows
    const rows = filteredInvoices.map(invoice => {
      const actions = components.actionButtons([
        { icon: '👁️', title: 'View', handler: `ui.viewInvoice('${invoice.id}')` },
        { icon: '✏️', title: 'Edit', handler: `ui.editInvoice('${invoice.id}')` },
        { icon: '📥', title: 'Download', handler: `ui.downloadInvoice('${invoice.id}')` },
        { icon: '🗑️', title: 'Delete', handler: `ui.deleteInvoice('${invoice.id}')` }
      ]);
      
      return components.tableRow([
        invoice.invoiceNumber,
        invoice.client,
        utils.formatCurrency(invoice.amount),
        utils.formatDate(invoice.date),
        utils.formatDate(invoice.dueDate),
        components.statusBadge(invoice.status),
        actions
      ]);
    }).join('');
    
    tbody.innerHTML = rows || '<tr><td colspan="7" class="text-center text-muted">No invoices found</td></tr>';
    
    // Update results count
    const resultsCount = document.getElementById('results-count');
    if (resultsCount) {
      resultsCount.textContent = `${filteredInvoices.length} of ${state.data.invoices.length} invoices`;
    }
  },

  // Render Clients
  clients: () => {
    const grid = document.getElementById('clients-grid');
    if (!grid) return;
    
    // Apply advanced filters
    let filteredClients = filters.applyClientFilters(state.data.clients);
    
    const clientsHtml = filteredClients.map(client => 
      components.clientCard(client)
    ).join('');
    
    grid.innerHTML = clientsHtml || '<p class="text-center text-muted">No clients found. Add your first client!</p>';
    
    // Update results count
    const resultsCount = document.getElementById('clients-results-count');
    if (resultsCount) {
      resultsCount.textContent = `${filteredClients.length} of ${state.data.clients.length} clients`;
    }
  },

  // Render Expenses
  expenses: () => {
    const content = document.getElementById('expense-content');
    if (!content) return;
    
    // Group expenses by category
    const expensesByCategory = {};
    let totalExpenses = 0;
    
    state.data.expenses.forEach(expense => {
      if (!expensesByCategory[expense.category]) {
        expensesByCategory[expense.category] = {
          amount: 0,
          count: 0,
          items: []
        };
      }
      expensesByCategory[expense.category].amount += expense.amount;
      expensesByCategory[expense.category].count++;
      expensesByCategory[expense.category].items.push(expense);
      totalExpenses += expense.amount;
    });
    
    content.innerHTML = `
      <div class="stats-row mb-lg">
        ${components.statCard('💰', utils.formatCurrency(totalExpenses), 'Total Expenses')}
        ${components.statCard('📊', Object.keys(expensesByCategory).length, 'Categories')}
        ${components.statCard('📝', state.data.expenses.length, 'Transactions')}
      </div>
      
      <div class="expense-categories">
        ${Object.entries(expensesByCategory).map(([category, data]) => `
          <div class="card">
            <h3>${category}</h3>
            <p class="text-muted">${data.count} transactions</p>
            <p class="text-success">${utils.formatCurrency(data.amount)}</p>
          </div>
        `).join('')}
      </div>
    `;
  },

  // Render Analytics
  analytics: () => {
    const content = document.getElementById('analytics-content');
    if (!content) return;
    
    const paidInvoices = state.data.invoices.filter(i => i.status === 'Paid');
    const revenue = paidInvoices.reduce((sum, i) => sum + i.amount, 0);
    const avgInvoice = paidInvoices.length > 0 ? revenue / paidInvoices.length : 0;
    
    // Find top client
    const clientRevenue = {};
    paidInvoices.forEach(invoice => {
      if (!clientRevenue[invoice.client]) clientRevenue[invoice.client] = 0;
      clientRevenue[invoice.client] += invoice.amount;
    });
    
    const topClient = Object.entries(clientRevenue)
      .sort((a, b) => b[1] - a[1])[0];
    
    content.innerHTML = `
      <div class="stats-row mb-lg">
        ${components.statCard('💵', utils.formatCurrency(revenue), 'Total Revenue')}
        ${components.statCard('📊', utils.formatCurrency(avgInvoice), 'Average Invoice')}
        ${components.statCard('🏆', topClient ? topClient[0] : 'N/A', 'Top Client')}
        ${components.statCard('📈', `${((paidInvoices.length / state.data.invoices.length) * 100).toFixed(0)}%`, 'Payment Rate')}
      </div>
      
      <div class="charts-row">
        <div class="chart-card">
          <h3>Revenue Trend</h3>
          <canvas id="revenue-trend-chart"></canvas>
        </div>
        <div class="chart-card">
          <h3>Client Distribution</h3>
          <canvas id="client-distribution-chart"></canvas>
        </div>
      </div>
    `;
    
    // Render analytics charts
    setTimeout(() => {
      charts.renderRevenueTrend();
      charts.renderClientDistribution();
    }, 100);
  },

  // Render Settings
  settings: () => {
    const content = document.getElementById('settings-content');
    if (!content) return;
    
    const { settings } = state.data;
    
    content.innerHTML = `
      <form id="settings-form" class="settings-form">
        <div class="card mb-lg">
          <h3>Business Information</h3>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Business Name</label>
              <input type="text" class="form-control" name="profileName" value="${settings.profileName}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" class="form-control" name="email" value="${settings.email || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Phone</label>
              <input type="tel" class="form-control" name="phone" value="${settings.phone || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">GSTIN</label>
              <input type="text" class="form-control" name="gstin" value="${settings.gstin || ''}" pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}">
            </div>
            <div class="form-group">
              <label class="form-label">PAN</label>
              <input type="text" class="form-control" name="pan" value="${settings.pan || ''}" pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}">
            </div>
            <div class="form-group">
              <label class="form-label">Address</label>
              <textarea class="form-control" name="address" rows="3">${settings.address || ''}</textarea>
            </div>
          </div>
        </div>
        
        <div class="card mb-lg">
          <h3>Invoice Settings</h3>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Invoice Prefix</label>
              <input type="text" class="form-control" name="invoicePrefix" value="${settings.invoicePrefix}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Currency</label>
              <select class="form-control" name="currency">
                <option value="INR" ${settings.currency === 'INR' ? 'selected' : ''}>INR (₹)</option>
                <option value="USD" ${settings.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
                <option value="EUR" ${settings.currency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Tax Rate (%)</label>
              <input type="number" class="form-control" name="taxRate" value="${settings.taxRate}" min="0" max="100" step="0.5">
            </div>
          </div>
        </div>
        
        <div class="card mb-lg">
          <h3>Banking Details</h3>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Bank Name</label>
              <input type="text" class="form-control" name="bankName" value="${settings.bankName || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Account Number</label>
              <input type="text" class="form-control" name="accountNumber" value="${settings.accountNumber || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">IFSC Code</label>
              <input type="text" class="form-control" name="ifsc" value="${settings.ifsc || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">UPI ID</label>
              <input type="text" class="form-control" name="upiId" value="${settings.upiId || ''}">
            </div>
          </div>
        </div>
        
        <div class="flex gap-md">
          <button type="submit" class="btn btn-primary">Save Settings</button>
          <button type="button" class="btn btn-secondary" onclick="ui.exportData()">Export Data</button>
        </div>
      </form>
    `;
    
    // Add form submit handler
    document.getElementById('settings-form').addEventListener('submit', ui.saveSettings);
  }
};

// ============================================
// 7. Advanced Filters & Search
// ============================================
const filters = {
  // Apply invoice filters
  applyInvoiceFilters: (invoices) => {
    let filtered = [...invoices];
    const f = state.filters.invoices;
    
    // Status filter
    if (f.status !== 'all') {
      filtered = filtered.filter(i => i.status.toLowerCase() === f.status.toLowerCase());
    }
    
    // Client filter
    if (f.client !== 'all') {
      filtered = filtered.filter(i => i.clientId === f.client);
    }
    
    // Date range filter
    if (f.dateRange.from) {
      filtered = filtered.filter(i => new Date(i.date) >= new Date(f.dateRange.from));
    }
    if (f.dateRange.to) {
      filtered = filtered.filter(i => new Date(i.date) <= new Date(f.dateRange.to));
    }
    
    // Amount range filter
    if (f.amountRange.min !== null) {
      filtered = filtered.filter(i => i.amount >= f.amountRange.min);
    }
    if (f.amountRange.max !== null) {
      filtered = filtered.filter(i => i.amount <= f.amountRange.max);
    }
    
    // Search filter (real-time)
    if (f.search) {
      const query = f.search.toLowerCase();
      filtered = filtered.filter(i => 
        i.invoiceNumber.toLowerCase().includes(query) ||
        i.client.toLowerCase().includes(query) ||
        i.description?.toLowerCase().includes(query) ||
        i.amount.toString().includes(query)
      );
    }
    
    // Sorting
    filtered.sort((a, b) => {
      let compareValue = 0;
      
      switch(f.sortBy) {
        case 'date':
          compareValue = new Date(a.date) - new Date(b.date);
          break;
        case 'amount':
          compareValue = a.amount - b.amount;
          break;
        case 'client':
          compareValue = a.client.localeCompare(b.client);
          break;
        case 'status':
          compareValue = a.status.localeCompare(b.status);
          break;
        default:
          compareValue = new Date(a.date) - new Date(b.date);
      }
      
      return f.sortOrder === 'asc' ? compareValue : -compareValue;
    });
    
    return filtered;
  },
  
  // Apply client filters
  applyClientFilters: (clients) => {
    let filtered = [...clients];
    const f = state.filters.clients;
    
    // Search filter
    if (f.search) {
      const query = f.search.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.phone?.toLowerCase().includes(query) ||
        c.company?.toLowerCase().includes(query)
      );
    }
    
    // Has invoices filter
    if (f.hasInvoices !== 'all') {
      const clientsWithInvoices = new Set(state.data.invoices.map(i => i.clientId));
      filtered = filtered.filter(c => {
        const hasInvoices = clientsWithInvoices.has(c.id);
        return f.hasInvoices === 'yes' ? hasInvoices : !hasInvoices;
      });
    }
    
    // Sorting
    filtered.sort((a, b) => {
      let compareValue = 0;
      
      switch(f.sortBy) {
        case 'name':
          compareValue = a.name.localeCompare(b.name);
          break;
        case 'totalAmount':
          const aTotal = state.data.invoices
            .filter(i => i.clientId === a.id)
            .reduce((sum, i) => sum + i.amount, 0);
          const bTotal = state.data.invoices
            .filter(i => i.clientId === b.id)
            .reduce((sum, i) => sum + i.amount, 0);
          compareValue = aTotal - bTotal;
          break;
        case 'invoiceCount':
          const aCount = state.data.invoices.filter(i => i.clientId === a.id).length;
          const bCount = state.data.invoices.filter(i => i.clientId === b.id).length;
          compareValue = aCount - bCount;
          break;
        default:
          compareValue = a.name.localeCompare(b.name);
      }
      
      return f.sortOrder === 'asc' ? compareValue : -compareValue;
    });
    
    return filtered;
  },
  
  // Apply expense filters
  applyExpenseFilters: (expenses) => {
    let filtered = [...expenses];
    const f = state.filters.expenses;
    
    // Category filter
    if (f.category !== 'all') {
      filtered = filtered.filter(e => e.category === f.category);
    }
    
    // Date range filter
    if (f.dateRange.from) {
      filtered = filtered.filter(e => new Date(e.date) >= new Date(f.dateRange.from));
    }
    if (f.dateRange.to) {
      filtered = filtered.filter(e => new Date(e.date) <= new Date(f.dateRange.to));
    }
    
    // Amount range filter
    if (f.amountRange.min !== null) {
      filtered = filtered.filter(e => e.amount >= f.amountRange.min);
    }
    if (f.amountRange.max !== null) {
      filtered = filtered.filter(e => e.amount <= f.amountRange.max);
    }
    
    // Tax deductible filter
    if (f.taxDeductible !== 'all') {
      filtered = filtered.filter(e => e.taxDeductible === (f.taxDeductible === 'yes'));
    }
    
    // Search filter
    if (f.search) {
      const query = f.search.toLowerCase();
      filtered = filtered.filter(e => 
        e.description?.toLowerCase().includes(query) ||
        e.category?.toLowerCase().includes(query) ||
        e.vendor?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  },
  
  // Reset filters
  resetInvoiceFilters: () => {
    state.filters.invoices = {
      status: 'all',
      client: 'all',
      dateRange: { from: null, to: null },
      amountRange: { min: null, max: null },
      search: '',
      sortBy: 'date',
      sortOrder: 'desc'
    };
    pages.invoices();
  },
  
  resetClientFilters: () => {
    state.filters.clients = {
      search: '',
      hasInvoices: 'all',
      sortBy: 'name',
      sortOrder: 'asc'
    };
    pages.clients();
  },
  
  // Create advanced filter UI
  createAdvancedFilterUI: (type) => {
    if (type === 'invoices') {
      return `
        <div class="advanced-filters">
          <h3>Advanced Filters</h3>
          <div class="filter-grid">
            <div class="filter-group">
              <label>Status</label>
              <select id="filter-status" onchange="filters.updateFilter('invoices', 'status', this.value)">
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
            
            <div class="filter-group">
              <label>Client</label>
              <select id="filter-client" onchange="filters.updateFilter('invoices', 'client', this.value)">
                <option value="all">All Clients</option>
                ${state.data.clients.map(c => 
                  `<option value="${c.id}">${c.name}</option>`
                ).join('')}
              </select>
            </div>
            
            <div class="filter-group">
              <label>Date From</label>
              <input type="date" id="filter-date-from" 
                onchange="filters.updateDateRange('invoices', 'from', this.value)">
            </div>
            
            <div class="filter-group">
              <label>Date To</label>
              <input type="date" id="filter-date-to"
                onchange="filters.updateDateRange('invoices', 'to', this.value)">
            </div>
            
            <div class="filter-group">
              <label>Min Amount</label>
              <input type="number" id="filter-amount-min" placeholder="0"
                onchange="filters.updateAmountRange('invoices', 'min', this.value)">
            </div>
            
            <div class="filter-group">
              <label>Max Amount</label>
              <input type="number" id="filter-amount-max" placeholder="999999"
                onchange="filters.updateAmountRange('invoices', 'max', this.value)">
            </div>
            
            <div class="filter-group">
              <label>Sort By</label>
              <select id="filter-sort" onchange="filters.updateSort('invoices', this.value)">
                <option value="date">Date</option>
                <option value="amount">Amount</option>
                <option value="client">Client</option>
                <option value="status">Status</option>
              </select>
            </div>
            
            <div class="filter-group">
              <label>Order</label>
              <select id="filter-order" onchange="filters.updateSortOrder('invoices', this.value)">
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
          </div>
          
          <div class="filter-actions">
            <button class="btn btn-secondary" onclick="filters.resetInvoiceFilters()">Reset Filters</button>
            <button class="btn btn-primary" onclick="filters.exportFiltered('invoices')">Export Filtered</button>
          </div>
        </div>
      `;
    }
    
    if (type === 'clients') {
      return `
        <div class="advanced-filters">
          <h3>Client Filters</h3>
          <div class="filter-grid">
            <div class="filter-group">
              <label>Has Invoices</label>
              <select onchange="filters.updateFilter('clients', 'hasInvoices', this.value)">
                <option value="all">All Clients</option>
                <option value="yes">With Invoices</option>
                <option value="no">Without Invoices</option>
              </select>
            </div>
            
            <div class="filter-group">
              <label>Sort By</label>
              <select onchange="filters.updateFilter('clients', 'sortBy', this.value)">
                <option value="name">Name</option>
                <option value="totalAmount">Total Revenue</option>
                <option value="invoiceCount">Invoice Count</option>
              </select>
            </div>
            
            <div class="filter-group">
              <label>Order</label>
              <select onchange="filters.updateFilter('clients', 'sortOrder', this.value)">
                <option value="asc">A to Z</option>
                <option value="desc">Z to A</option>
              </select>
            </div>
          </div>
          
          <div class="filter-actions">
            <button class="btn btn-secondary" onclick="filters.resetClientFilters()">Reset</button>
          </div>
        </div>
      `;
    }
  },
  
  // Update filter value
  updateFilter: (type, key, value) => {
    state.filters[type][key] = value;
    pages[type]();
  },
  
  // Update date range
  updateDateRange: (type, field, value) => {
    state.filters[type].dateRange[field] = value;
    pages[type]();
  },
  
  // Update amount range
  updateAmountRange: (type, field, value) => {
    state.filters[type].amountRange[field] = value ? parseFloat(value) : null;
    pages[type]();
  },
  
  // Update sort
  updateSort: (type, value) => {
    state.filters[type].sortBy = value;
    pages[type]();
  },
  
  // Update sort order
  updateSortOrder: (type, value) => {
    state.filters[type].sortOrder = value;
    pages[type]();
  },
  
  // Export filtered data
  exportFiltered: (type) => {
    let data = [];
    let filename = '';
    
    if (type === 'invoices') {
      data = filters.applyInvoiceFilters(state.data.invoices);
      filename = 'filtered-invoices';
    } else if (type === 'clients') {
      data = filters.applyClientFilters(state.data.clients);
      filename = 'filtered-clients';
    }
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    utils.showToast(`Exported ${data.length} ${type}`, 'success');
  }
};

// ============================================
// 8. Real-time Search System
// ============================================
const search = {
  // Initialize global search
  initGlobalSearch: () => {
    const searchBox = document.createElement('div');
    searchBox.className = 'global-search-box';
    searchBox.innerHTML = `
      <input type="text" id="global-search" placeholder="Search everything... (Ctrl+K)">
      <div id="search-results" class="search-results"></div>
    `;
    document.body.appendChild(searchBox);
    
    const input = document.getElementById('global-search');
    
    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchBox.classList.toggle('active');
        if (searchBox.classList.contains('active')) {
          input.focus();
        }
      }
      
      if (e.key === 'Escape') {
        searchBox.classList.remove('active');
      }
    });
    
    // Real-time search
    input.addEventListener('input', utils.debounce((e) => {
      search.performGlobalSearch(e.target.value);
    }, 200));
  },
  
  // Perform global search
  performGlobalSearch: (query) => {
    if (!query) {
      document.getElementById('search-results').innerHTML = '';
      return;
    }
    
    const results = {
      invoices: [],
      clients: [],
      expenses: []
    };
    
    const q = query.toLowerCase();
    
    // Search invoices
    results.invoices = state.data.invoices.filter(i => 
      i.invoiceNumber.toLowerCase().includes(q) ||
      i.client.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q)
    ).slice(0, 5);
    
    // Search clients
    results.clients = state.data.clients.filter(c => 
      c.name.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q)
    ).slice(0, 5);
    
    // Search expenses
    results.expenses = state.data.expenses.filter(e => 
      e.description?.toLowerCase().includes(q) ||
      e.category?.toLowerCase().includes(q)
    ).slice(0, 5);
    
    // Display results
    search.displayResults(results, query);
  },
  
  // Display search results
  displayResults: (results, query) => {
    const container = document.getElementById('search-results');
    
    let html = '';
    
    if (results.invoices.length > 0) {
      html += '<div class="search-category"><h4>Invoices</h4>';
      results.invoices.forEach(invoice => {
        html += `
          <div class="search-item" onclick="search.goToInvoice('${invoice.id}')">
            <span class="search-icon">📄</span>
            <div>
              <strong>${search.highlight(invoice.invoiceNumber, query)}</strong>
              <small>${search.highlight(invoice.client, query)} - ${utils.formatCurrency(invoice.amount)}</small>
            </div>
          </div>
        `;
      });
      html += '</div>';
    }
    
    if (results.clients.length > 0) {
      html += '<div class="search-category"><h4>Clients</h4>';
      results.clients.forEach(client => {
        html += `
          <div class="search-item" onclick="search.goToClient('${client.id}')">
            <span class="search-icon">👤</span>
            <div>
              <strong>${search.highlight(client.name, query)}</strong>
              <small>${search.highlight(client.email || 'No email', query)}</small>
            </div>
          </div>
        `;
      });
      html += '</div>';
    }
    
    if (results.expenses.length > 0) {
      html += '<div class="search-category"><h4>Expenses</h4>';
      results.expenses.forEach(expense => {
        html += `
          <div class="search-item" onclick="search.goToExpense('${expense.id}')">
            <span class="search-icon">💰</span>
            <div>
              <strong>${search.highlight(expense.description || expense.category, query)}</strong>
              <small>${utils.formatCurrency(expense.amount)} - ${utils.formatDate(expense.date)}</small>
            </div>
          </div>
        `;
      });
      html += '</div>';
    }
    
    if (!html) {
      html = '<div class="no-results">No results found</div>';
    }
    
    container.innerHTML = html;
  },
  
  // Highlight search term
  highlight: (text, query) => {
    if (!text) return '';
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  },
  
  // Navigation helpers
  goToInvoice: (id) => {
    ui.navigateTo('invoices');
    setTimeout(() => ui.viewInvoice(id), 100);
    document.querySelector('.global-search-box').classList.remove('active');
  },
  
  goToClient: (id) => {
    ui.navigateTo('clients');
    setTimeout(() => ui.viewClient(id), 100);
    document.querySelector('.global-search-box').classList.remove('active');
  },
  
  goToExpense: (id) => {
    ui.navigateTo('expenses');
    setTimeout(() => ui.viewExpense(id), 100);
    document.querySelector('.global-search-box').classList.remove('active');
  }
};

// ============================================
// 9. Charts
// ============================================
const charts = {
  chartInstances: {},
  
  destroy: (chartId) => {
    if (charts.chartInstances[chartId]) {
      charts.chartInstances[chartId].destroy();
      delete charts.chartInstances[chartId];
    }
  },
  
  renderMonthlyRevenue: () => {
    const ctx = document.getElementById('monthly-revenue-chart');
    if (!ctx) return;
    
    charts.destroy('monthly-revenue');
    
    // Prepare data
    const monthlyData = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    state.data.invoices.filter(i => i.status === 'Paid').forEach(invoice => {
      const month = new Date(invoice.date).getMonth();
      if (!monthlyData[month]) monthlyData[month] = 0;
      monthlyData[month] += invoice.amount;
    });
    
    charts.chartInstances['monthly-revenue'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [{
          label: 'Revenue',
          data: months.map((_, i) => monthlyData[i] || 0),
          borderColor: '#5E72E4',
          backgroundColor: 'rgba(94, 114, 228, 0.1)',
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        }
      }
    });
  },
  
  renderInvoiceStatus: () => {
    const ctx = document.getElementById('invoice-status-chart');
    if (!ctx) return;
    
    charts.destroy('invoice-status');
    
    const statusCount = {
      Paid: state.data.invoices.filter(i => i.status === 'Paid').length,
      Pending: state.data.invoices.filter(i => i.status === 'Pending').length,
      Overdue: state.data.invoices.filter(i => i.status === 'Overdue').length
    };
    
    charts.chartInstances['invoice-status'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(statusCount),
        datasets: [{
          data: Object.values(statusCount),
          backgroundColor: ['#2DCE89', '#FB6340', '#F5365C']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  },
  
  renderRevenueTrend: () => {
    const ctx = document.getElementById('revenue-trend-chart');
    if (!ctx) return;
    
    charts.destroy('revenue-trend');
    
    // Group by month
    const trendData = {};
    state.data.invoices.filter(i => i.status === 'Paid').forEach(invoice => {
      const date = new Date(invoice.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!trendData[key]) trendData[key] = 0;
      trendData[key] += invoice.amount;
    });
    
    const sortedKeys = Object.keys(trendData).sort();
    
    charts.chartInstances['revenue-trend'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sortedKeys,
        datasets: [{
          label: 'Revenue',
          data: sortedKeys.map(k => trendData[k]),
          backgroundColor: '#5E72E4'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  },
  
  renderClientDistribution: () => {
    const ctx = document.getElementById('client-distribution-chart');
    if (!ctx) return;
    
    charts.destroy('client-distribution');
    
    const clientData = {};
    state.data.invoices.forEach(invoice => {
      if (!clientData[invoice.client]) clientData[invoice.client] = 0;
      clientData[invoice.client] += invoice.amount;
    });
    
    const sortedClients = Object.entries(clientData)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    charts.chartInstances['client-distribution'] = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: sortedClients.map(c => c[0]),
        datasets: [{
          data: sortedClients.map(c => c[1]),
          backgroundColor: ['#5E72E4', '#2DCE89', '#FB6340', '#11CDEF', '#F5365C']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }
};

// ============================================
// 8. UI Handlers
// ============================================
const ui = {
  // Initialize UI
  init: () => {
    // Setup navigation
    document.querySelectorAll('.nav-item').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        ui.navigateTo(page);
      });
    });
    
    // Setup mobile menu
    const hamburger = document.getElementById('hamburger');
    if (hamburger) {
      hamburger.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('active');
      });
    }
    
    // Setup real-time search for invoices
    const invoiceSearch = document.getElementById('invoice-search');
    if (invoiceSearch) {
      invoiceSearch.addEventListener('input', utils.debounce((e) => {
        state.filters.invoices.search = e.target.value;
        pages.invoices();
      }, 200));
    }
    
    // Setup filter tabs with advanced options
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.filters.invoices.status = tab.dataset.filter;
        pages.invoices();
      });
    });
    
    // Add advanced filter toggle button
    ui.addAdvancedFilterButtons();
    
    // Initialize global search
    search.initGlobalSearch();
    
    // Setup action buttons
    document.getElementById('create-invoice-btn')?.addEventListener('click', () => ui.createInvoice());
    document.getElementById('new-invoice-btn')?.addEventListener('click', () => ui.createInvoice());
    document.getElementById('add-client-btn')?.addEventListener('click', () => ui.createClient());
    document.getElementById('add-expense-btn')?.addEventListener('click', () => ui.createExpense());
    document.getElementById('export-invoices-btn')?.addEventListener('click', () => ui.exportInvoices());
    
    // Setup keyboard shortcuts
    ui.setupKeyboardShortcuts();
  },
  
  // Add advanced filter buttons
  addAdvancedFilterButtons: () => {
    // Add to invoices page
    const invoicesFilters = document.querySelector('#invoices-page .filters-bar');
    if (invoicesFilters && !document.getElementById('advanced-filters-btn')) {
      const btn = document.createElement('button');
      btn.id = 'advanced-filters-btn';
      btn.className = 'btn btn-secondary';
      btn.innerHTML = '⚙️ Advanced Filters';
      btn.onclick = () => ui.toggleAdvancedFilters('invoices');
      invoicesFilters.appendChild(btn);
    }
    
    // Add to clients page
    const clientsHeader = document.querySelector('#clients-page .page-header');
    if (clientsHeader && !document.getElementById('client-filters-btn')) {
      const filterBar = document.createElement('div');
      filterBar.className = 'filters-bar';
      filterBar.innerHTML = `
        <div class="search-box">
          <input type="text" id="client-search" placeholder="Search clients...">
        </div>
        <button class="btn btn-secondary" onclick="ui.toggleAdvancedFilters('clients')">
          ⚙️ Filters
        </button>
        <span id="clients-results-count" class="results-count"></span>
      `;
      clientsHeader.after(filterBar);
      
      // Setup client search
      document.getElementById('client-search')?.addEventListener('input', utils.debounce((e) => {
        state.filters.clients.search = e.target.value;
        pages.clients();
      }, 200));
    }
  },
  
  // Toggle advanced filters
  toggleAdvancedFilters: (type) => {
    const existingPanel = document.getElementById(`${type}-advanced-filters`);
    
    if (existingPanel) {
      existingPanel.remove();
      state.ui.advancedFiltersOpen = false;
    } else {
      const page = document.getElementById(`${type}-page`);
      const filtersBar = page.querySelector('.filters-bar');
      
      const panel = document.createElement('div');
      panel.id = `${type}-advanced-filters`;
      panel.className = 'advanced-filters-panel';
      panel.innerHTML = filters.createAdvancedFilterUI(type);
      
      filtersBar.after(panel);
      state.ui.advancedFiltersOpen = true;
      
      // Animate panel entrance
      setTimeout(() => panel.classList.add('active'), 10);
    }
  },
  
  // Setup keyboard shortcuts
  setupKeyboardShortcuts: () => {
    document.addEventListener('keydown', (e) => {
      // Alt + N: New Invoice
      if (e.altKey && e.key === 'n') {
        e.preventDefault();
        ui.createInvoice();
      }
      
      // Alt + C: New Client
      if (e.altKey && e.key === 'c') {
        e.preventDefault();
        ui.createClient();
      }
      
      // Alt + E: Export
      if (e.altKey && e.key === 'e') {
        e.preventDefault();
        ui.exportData();
      }
      
      // Alt + 1-6: Navigate to pages
      if (e.altKey && e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        const pages = ['dashboard', 'invoices', 'clients', 'expenses', 'analytics', 'settings'];
        ui.navigateTo(pages[parseInt(e.key) - 1]);
      }
    });
  },
  
  // Navigate to page
  navigateTo: (page) => {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(link => {
      link.classList.toggle('active', link.dataset.page === page);
    });
    
    // Update pages
    document.querySelectorAll('.page').forEach(p => {
      p.classList.toggle('active', p.id === `${page}-page`);
    });
    
    // Update state
    state.currentPage = page;
    
    // Render page content
    if (pages[page]) {
      pages[page]();
    }
    
    // Close mobile menu
    document.getElementById('sidebar')?.classList.remove('active');
  },
  
  // Create invoice
  createInvoice: () => {
    const modalContent = `
      <form id="invoice-form">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Client</label>
            <select class="form-control" name="clientId" required>
              <option value="">Select Client</option>
              ${state.data.clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Invoice Number</label>
            <input type="text" class="form-control" name="invoiceNumber" value="${state.data.settings.invoicePrefix}-${Date.now().toString().slice(-4)}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input type="date" class="form-control" name="date" value="${new Date().toISOString().split('T')[0]}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Due Date</label>
            <input type="date" class="form-control" name="dueDate" required>
          </div>
          <div class="form-group">
            <label class="form-label">Amount</label>
            <input type="number" class="form-control" name="amount" min="0" step="0.01" required>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-control" name="status">
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-control" name="description" rows="3"></textarea>
        </div>
      </form>
    `;
    
    const footer = `
      <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="ui.saveInvoice()">Save Invoice</button>
    `;
    
    ui.showModal('Create Invoice', modalContent, footer);
  },
  
  // Save invoice
  saveInvoice: async () => {
    const form = document.getElementById('invoice-form');
    const formData = new FormData(form);
    
    const invoice = {
      id: utils.generateId(),
      clientId: formData.get('clientId'),
      client: state.data.clients.find(c => c.id === formData.get('clientId'))?.name || '',
      invoiceNumber: formData.get('invoiceNumber'),
      date: formData.get('date'),
      dueDate: formData.get('dueDate'),
      amount: parseFloat(formData.get('amount')),
      status: formData.get('status'),
      description: formData.get('description'),
      created_at: new Date().toISOString()
    };
    
    try {
      await database.saveInvoice(invoice);
      utils.showToast('Invoice saved successfully', 'success');
      ui.closeModal();
      pages.invoices();
    } catch (error) {
      utils.showToast('Error saving invoice', 'error');
    }
  },
  
  // Delete invoice
  deleteInvoice: async (id) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    
    try {
      await database.deleteInvoice(id);
      utils.showToast('Invoice deleted successfully', 'success');
      pages.invoices();
    } catch (error) {
      utils.showToast('Error deleting invoice', 'error');
    }
  },
  
  // Create client
  createClient: () => {
    const modalContent = `
      <form id="client-form">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Name</label>
            <input type="text" class="form-control" name="name" required>
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-control" name="email">
          </div>
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input type="tel" class="form-control" name="phone">
          </div>
          <div class="form-group">
            <label class="form-label">Company</label>
            <input type="text" class="form-control" name="company">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Address</label>
          <textarea class="form-control" name="address" rows="3"></textarea>
        </div>
      </form>
    `;
    
    const footer = `
      <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="ui.saveClient()">Save Client</button>
    `;
    
    ui.showModal('Add Client', modalContent, footer);
  },
  
  // Save client
  saveClient: async () => {
    const form = document.getElementById('client-form');
    const formData = new FormData(form);
    
    const client = {
      id: utils.generateId(),
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      company: formData.get('company'),
      address: formData.get('address'),
      created_at: new Date().toISOString()
    };
    
    try {
      await database.saveClient(client);
      utils.showToast('Client saved successfully', 'success');
      ui.closeModal();
      pages.clients();
    } catch (error) {
      utils.showToast('Error saving client', 'error');
    }
  },
  
  // Delete client
  deleteClient: async (id) => {
    if (!confirm('Are you sure you want to delete this client?')) return;
    
    try {
      await database.deleteClient(id);
      utils.showToast('Client deleted successfully', 'success');
      pages.clients();
    } catch (error) {
      utils.showToast('Error deleting client', 'error');
    }
  },
  
  // Save settings
  saveSettings: async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const settings = {};
    formData.forEach((value, key) => {
      settings[key] = key === 'taxRate' ? parseFloat(value) : value;
    });
    
    try {
      await database.saveSettings(settings);
      utils.showToast('Settings saved successfully', 'success');
    } catch (error) {
      utils.showToast('Error saving settings', 'error');
    }
  },
  
  // Show modal
  showModal: (title, content, footer) => {
    const container = document.getElementById('modal-container');
    container.innerHTML = components.modal(title, content, footer);
    state.ui.modalOpen = true;
  },
  
  // Close modal
  closeModal: (event) => {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('modal-container').innerHTML = '';
    state.ui.modalOpen = false;
  },
  
  // Export data
  exportData: () => {
    const data = {
      invoices: state.data.invoices,
      clients: state.data.clients,
      expenses: state.data.expenses,
      settings: state.data.settings,
      exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-manager-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    utils.showToast('Data exported successfully', 'success');
  },
  
  // Export invoices
  exportInvoices: () => {
    // Create CSV
    const headers = ['Invoice #', 'Client', 'Amount', 'Date', 'Due Date', 'Status'];
    const rows = state.data.invoices.map(i => [
      i.invoiceNumber,
      i.client,
      i.amount,
      i.date,
      i.dueDate,
      i.status
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    utils.showToast('Invoices exported successfully', 'success');
  }
};

// ============================================
// 9. Application Initialization
// ============================================
const app = {
  init: async () => {
    console.log('🚀 Initializing application...');
    
    // Check authentication
    if (!auth.check()) {
      return;
    }
    
    // Initialize database
    await database.init();
    
    // Load data
    await database.loadData();
    
    // Initialize UI
    ui.init();
    
    // Navigate to dashboard
    ui.navigateTo('dashboard');
    
    // Show welcome message
    const username = localStorage.getItem('username') || 'User';
    utils.showToast(`Welcome back, ${username}!`, 'success');
    
    console.log('✅ Application initialized successfully');
  }
};

// ============================================
// 10. Start Application
// ============================================
document.addEventListener('DOMContentLoaded', app.init);
