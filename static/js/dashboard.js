let ctx = null
try{
    ctx = document.getElementById('spendingChart').getContext('2d');
}catch{
    console.log("no chart context")
}
let currentPurchaseId = null;

function editPurchase(purchaseId) {
    console.log('editPurchase called with ID:', purchaseId);
    currentPurchaseId = purchaseId;
    
    // Get purchase data and populate form
    fetch(`/api/purchases/${purchaseId}`)
        .then(response => response.json())
        .then(data => {
            console.log('Purchase data received:', data);
            document.getElementById('editCategory').value = data.category;
            
            // Show modal using Bootstrap 5 syntax
            const modalElement = document.getElementById('editPurchaseModal');
            console.log('Modal element:', modalElement);
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        })
        .catch(error => {
            console.error('Error fetching purchase data:', error);
            showAlert('danger', 'Error loading purchase data');
        });
}

function savePurchaseEdit() {
    const category = document.getElementById('editCategory').value;
    
    fetch(`/api/purchases/${currentPurchaseId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            category: category,
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Close modal using Bootstrap 5 syntax
            const modalElement = document.getElementById('editPurchaseModal');
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.hide();
            }
            
            // Show success message
            showAlert('success', 'Purchase updated successfully');
            
            // Reload page to show updated data
            setTimeout(() => location.reload(), 1000);
        } else {
            showAlert('danger', 'Error updating purchase');
        }
    })
    .catch(error => {
        console.error('Error updating purchase:', error);
        showAlert('danger', 'Error updating purchase: ' + error);
    });
}

//function cleanupDuplicates() {
//    if (confirm('This will remove duplicate purchases from your database. Continue?')) {
//        fetch('/api/cleanup-duplicates')
//            .then(response => response.json())
//            .then(data => {
//                if (data.success) {
//                    showAlert('success', data.message);
//                    // Reload page to show updated data
//                    setTimeout(() => location.reload(), 1500);
//                } else {
//                    showAlert('danger', 'Error cleaning up duplicates: ' + data.error);
//                }
//            })
//            .catch(error => {
//                showAlert('danger', 'Error cleaning up duplicates: ' + error);
//            });
//    }
//}

function autoCategorizeAll() {
    if (confirm('This will automatically categorize all uncategorized purchases. Continue?')) {
        fetch('/api/auto-categorize-all', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showAlert('success', data.message);
                    // Reload page to show updated data
                    setTimeout(() => location.reload(), 1500);
                } else {
                    showAlert('danger', 'Error auto-categorizing: ' + data.error);
                }
            })
            .catch(error => {
                showAlert('danger', 'Error auto-categorizing: ' + error);
            });
    }
}

function toggleBulkMode() {
    const bulkSelectHeader = document.getElementById('bulkSelectHeader');
    const bulkSelectCells = document.querySelectorAll('.bulk-select-cell');
    const bulkControls = document.getElementById('bulkControls');
    const button = event.target.closest('button');
    
    if (bulkSelectHeader.style.display === 'none') {
        // Enable bulk mode
        bulkSelectHeader.style.display = 'table-cell';
        bulkSelectCells.forEach(cell => cell.style.display = 'table-cell');
        bulkControls.style.display = 'block';
        button.innerHTML = '<i class="fas fa-times me-1"></i>Exit Bulk Edit';
        button.className = 'btn btn-sm btn-outline-danger';
    } else {
        // Disable bulk mode
        bulkSelectHeader.style.display = 'none';
        bulkSelectCells.forEach(cell => cell.style.display = 'none');
        bulkControls.style.display = 'none';
        button.innerHTML = '<i class="fas fa-edit me-1"></i>Bulk Edit';
        button.className = 'btn btn-sm btn-outline-success';
        
        // Uncheck all checkboxes
        document.querySelectorAll('.purchase-select').forEach(cb => cb.checked = false);
        document.getElementById('selectAll').checked = false;
        updateSelectedCount();
    }
}

function toggleSelectAll() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.purchase-select');
    
    checkboxes.forEach(cb => cb.checked = selectAll.checked);
    updateSelectedCount();
}

function updateSelectedCount() {
    const selectedCheckboxes = document.querySelectorAll('.purchase-select:checked');
    const selectedCount = document.getElementById('selectedCount');
    selectedCount.textContent = `${selectedCheckboxes.length} purchases selected`;
}

function autoSyncOnLoad() {
    // Check if we have any purchases - if not, skip auto-sync
    //const purchaseCount = document.querySelectorAll('tbody tr').length;
    //if (purchaseCount === 0) {
    //    console.log('No purchases found, skipping auto-sync');
    //    return;
    //}
    
    // Check if we've already auto-synced this session to prevent infinite loops
    if (sessionStorage.getItem('autoSyncCompleted')) {
        console.log('Auto-sync already completed this session, skipping');
        return;
    }
    
    // Check if we're already syncing to prevent multiple simultaneous syncs
    if (window.isAutoSyncing) {
        console.log('Auto-sync already in progress, skipping');
        return;
    }
    
    // Set flag to prevent multiple syncs
    window.isAutoSyncing = true;
    
    // Show auto-sync status indicator
    const statusBadge = document.getElementById('autoSyncStatus');
    if (statusBadge) {
        statusBadge.style.display = 'inline-block';
    } 
        
    // Perform the sync
    fetch('/sync-gmail')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Mark auto-sync as completed for this session
                sessionStorage.setItem('autoSyncCompleted', 'true');
                
                // Show success message
                showAlert('success', data.message);
                
                // Instead of reloading, just hide the status and restore the button
                // This prevents the infinite loop while still showing the sync completed
                setTimeout(() => {
                    if (statusBadge) statusBadge.style.display = 'none';
                    window.isAutoSyncing = false;
                    
                    // Show a refresh suggestion
                    showAlert('info', 'Auto-sync completed! Click "Refresh Data" button above to see updated purchases.');
                }, 1500);
            } else {
                showAlert('danger', 'Auto-sync error: ' + data.error);
                // Reset flags and restore button
                window.isAutoSyncing = false;
                if (statusBadge) statusBadge.style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Auto-sync error:', error);
            showAlert('danger', 'Auto-sync failed: ' + error);
            // Reset flags and restore button
            window.isAutoSyncing = false;
            if (statusBadge) statusBadge.style.display = 'none';
    });
}

function refreshData() {
    // Simple page refresh to show updated data
    location.reload();
}

function showAddPurchaseModal() {
    // Reset form
    document.getElementById('addPurchaseForm').reset();
    document.getElementById('addPurchaseDate').value = new Date().toISOString().split('T')[0];
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('addPurchaseModal'));
    modal.show();
}

function saveNewPurchase() {
    const date = document.getElementById('addPurchaseDate').value;
    const merchant = document.getElementById('addPurchaseMerchant').value;
    const amount = document.getElementById('addPurchaseAmount').value;
    const category = document.getElementById('addPurchaseCategory').value;
    
    // Validate required fields
    if (!date || !merchant || !amount) {
        showAlert('warning', 'Please fill in all required fields (Date, Merchant, Amount)');
        return;
    }
    
    // Validate amount
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        showAlert('warning', 'Please enter a valid amount greater than 0');
        return;
    }
    
    // Create purchase data
    const purchaseData = {
        date: date,
        merchant: merchant.trim(),
        amount: parseFloat(amount),
        category: category,
    };
    
    // Send to API
    fetch('/api/purchases', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(purchaseData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addPurchaseModal'));
            modal.hide();
            
            // Show success message
            showAlert('success', 'Purchase added successfully!');
            
            // Reload page to show new purchase
            setTimeout(() => location.reload(), 1000);
        } else {
            showAlert('danger', 'Error adding purchase: ' + (data.error || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('Error adding purchase:', error);
        showAlert('danger', 'Error adding purchase: ' + error);
    });
}

function applyBulkCategory() {
    const selectedCheckboxes = document.querySelectorAll('.purchase-select:checked');
    const category = document.getElementById('bulkCategory').value;
    
    if (selectedCheckboxes.length === 0) {
        showAlert('warning', 'Please select at least one purchase');
        return;
    }
    
    if (!category) {
        showAlert('warning', 'Please select a category');
        return;
    }
    
    const purchaseIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value));
    
    fetch('/api/bulk-categorize', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            purchase_ids: purchaseIds,
            category: category
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert('success', data.message);
            // Reload page to show updated data
            setTimeout(() => location.reload(), 1500);
        } else {
            showAlert('danger', 'Error updating purchases: ' + data.error);
        }
    })
    .catch(error => {
        showAlert('danger', 'Error updating purchases: ' + error);
    });
}
