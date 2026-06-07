/**
 * FinTrack — setting.js
 * Logic for responsive nested settings, Import, and Export functionality.
 */

document.addEventListener('DOMContentLoaded', () => {

  const viewMain = document.getElementById('view-main');
  const viewData = document.getElementById('view-data');
  const viewSecurity = document.getElementById('view-security');
  const headerTitle = document.getElementById('header-title');

  // Navigation Logic
  window.openView = function(viewId) {
    viewMain.classList.remove('active');
    viewMain.classList.add('hidden-left');
    
    const targetView = document.getElementById(viewId);
    if (targetView) {
      targetView.classList.remove('hidden-right');
      targetView.classList.add('active');
    }
    
    if (viewId === 'view-data') headerTitle.textContent = 'Data';
    if (viewId === 'view-security') headerTitle.textContent = 'Security';
  };

  window.closeView = function(viewId) {
    const targetView = document.getElementById(viewId);
    if (targetView) {
      targetView.classList.remove('active');
      targetView.classList.add('hidden-right');
    }
    
    viewMain.classList.remove('hidden-left');
    viewMain.classList.add('active');
    headerTitle.textContent = 'Settings';

    // Clear security inputs on close to be safe
    if (viewId === 'view-security') {
      document.getElementById('sec-auth-input').value = '';
      document.getElementById('sec-setup-input1').value = '';
      document.getElementById('sec-setup-input2').value = '';
    }
  };

  // ── Database Import & Export Handlers ── //

  const btnExport = document.getElementById('btn-export');
  const btnImport = document.getElementById('btn-import');
  const fileImport = document.getElementById('file-import');

  // Export Data
  btnExport.addEventListener('click', () => {
    try {
      const jsonStr = DB.exportData();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `fintrack-backup-${today()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast('Data exported successfully!', 'ok');
    } catch (e) {
      console.error(e);
      toast('Failed to export data', 'error');
    }
  });

  // Import Data Logic
  btnImport.addEventListener('click', () => {
    // Trigger hidden file input
    fileImport.click();
  });

  fileImport.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const jsonData = event.target.result;
      const success = DB.importData(jsonData);
      
      if (success) {
        toast('Data imported successfully!', 'ok');
        // Reset the file input so the same file could be imported again if needed
        fileImport.value = '';
      } else {
        toast('Failed to import data. Invalid file format.', 'error');
      }
    };

    reader.onerror = () => {
      toast('Error reading file.', 'error');
    };

    reader.readAsText(file);
  });

  // ── Clear Data Handlers ── //
  const btnClear = document.getElementById('btn-clear-data');
  const clearModal = document.getElementById('clear-auth-modal');
  const clearInput = document.getElementById('clear-auth-input');

  btnClear.addEventListener('click', () => {
    if (DB.hasPwd()) {
      clearModal.style.display = 'block';
      clearInput.value = '';
    } else {
      if (confirm('Are you sure you want to permanently delete ALL your data? This cannot be undone.')) {
        performWipe();
      }
    }
  });

  window.confirmClearData = function() {
    if (DB.checkPwd(clearInput.value)) {
      performWipe();
    } else {
      toast('Incorrect password', 'error');
    }
  };

  function performWipe() {
    DB.wipeAllData();
    toast('All data cleared', 'ok');
    setTimeout(() => location.reload(), 800);
  }

  // ── Security Handlers ── //

  window.openSecurity = function() {
    openView('view-security');
    const stAuth = document.getElementById('sec-auth-state');
    const stSetup = document.getElementById('sec-setup-state');
    const stManage = document.getElementById('sec-manage-state');

    stAuth.style.display = 'none';
    stSetup.style.display = 'none';
    stManage.style.display = 'none';

    if (DB.hasPwd()) {
      stAuth.style.display = 'block';
    } else {
      stSetup.style.display = 'block';
    }
  };

  window.authenticateSecurity = function() {
    const p = document.getElementById('sec-auth-input').value;
    if (DB.checkPwd(p)) {
      document.getElementById('sec-auth-state').style.display = 'none';
      document.getElementById('sec-manage-state').style.display = 'block';
      document.getElementById('sec-auth-input').value = '';
    } else {
      toast('Incorrect password', 'error');
    }
  };

  window.setupSecurity = function() {
    const p1 = document.getElementById('sec-setup-input1').value;
    const p2 = document.getElementById('sec-setup-input2').value;

    if (!p1) {
      toast('Password cannot be empty', 'error');
      return;
    }
    if (p1 !== p2) {
      toast('Passwords do not match', 'error');
      return;
    }

    DB.setPwd(p1);
    toast('Security password set!', 'ok');
    document.getElementById('sec-setup-input1').value = '';
    document.getElementById('sec-setup-input2').value = '';
    
    document.getElementById('sec-setup-state').style.display = 'none';
    document.getElementById('sec-manage-state').style.display = 'block';
  };

  window.removePassword = function() {
    if (confirm('Are you sure you want to remove your master password?')) {
      DB.removePwd();
      toast('Password removed', 'ok');
      closeView('view-security');
    }
  };

  window.changePasswordFlow = function() {
    document.getElementById('sec-manage-state').style.display = 'none';
    document.getElementById('sec-setup-state').style.display = 'block';
  };

});
