let currentPurchaseId = null;
    let allPurchases = [];

    // Load all purchases for client-side filtering
    fetch('/api/purchases')
        .then(response => response.json())
        .then(data => {
            allPurchases = data;
        });

function searchPurchases() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;
    
    const filtered = allPurchases.filter(purchase => {
        const matchesSearch = purchase.merchant.toLowerCase().includes(searchTerm)
        const matchesCategory = !categoryFilter || purchase.category === categoryFilter;
        
        return matchesSearch && matchesCategory;
    });
    
    displayFilteredPurchases(filtered);
}

function filterPurchases() {
    searchPurchases(); // Re-run search with current filters
}

function sortPurchases() {
    const sortBy = document.getElementById('sortBy').value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;
    
    let filtered = allPurchases.filter(purchase => {
        const matchesSearch = purchase.merchant.toLowerCase().includes(searchTerm)
        const matchesCategory = !categoryFilter || purchase.category === categoryFilter;
        
        return matchesSearch && matchesCategory;
    });
    
    // Sort the filtered results
    switch(sortBy) {
        case 'date_desc':
            filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
            break;
        case 'date_asc':
            filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
            break;
        case 'amount_desc':
            filtered.sort((a, b) => b.amount - a.amount);
            break;
        case 'amount_asc':
            filtered.sort((a, b) => a.amount - b.amount);
            break;
        case 'merchant':
            filtered.sort((a, b) => a.merchant.localeCompare(b.merchant));
            break;
    }
    
    displayFilteredPurchases(filtered);
}

function displayFilteredPurchases(purchases) {
    const tbody = document.querySelector('tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    purchases.forEach(purchase => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(purchase.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
            <td>${purchase.merchant}</td>
            <td><strong>$${parseFloat(purchase.amount).toFixed(2)}</strong></td>
            <td><span class="badge bg-secondary">${purchase.category}</span></td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editPurchase(${purchase.id})">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function editPurchase(purchaseId) {
    currentPurchaseId = purchaseId;
    
    // Get purchase data and populate form
    fetch(`/api/purchases/${purchaseId}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('editCategory').value = data.category;
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('editPurchaseModal'));
            modal.show();
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
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('editPurchaseModal'));
            modal.hide();
            
            // Show success message
            showAlert('success', 'Purchase updated successfully');
            
            // Reload page to show updated data
            setTimeout(() => location.reload(), 1000);
        } else {
            showAlert('danger', 'Error updating purchase');
        }
    })
    .catch(error => {
        showAlert('danger', 'Error updating purchase: ' + error);
    });
}

function exportPurchases() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;
    
    let filtered = allPurchases.filter(purchase => {
        const matchesSearch = purchase.merchant.toLowerCase().includes(searchTerm)
        const matchesCategory = !categoryFilter || purchase.category === categoryFilter;
        
        return matchesSearch && matchesCategory;
    });
    
    // Create CSV content
    const csvContent = [
        ['Date', 'Merchant', 'Amount', 'Category'],
        ...filtered.map(p => [
            new Date(p.date).toLocaleDateString(),
            p.merchant,
            p.amount,
            p.category,
        ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    // Download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'purchases.csv';
    a.click();
    window.URL.revokeObjectURL(url);
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
