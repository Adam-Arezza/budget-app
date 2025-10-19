let currentBudgetId = null;
let isEditMode = false;

// Load budget data when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadBudgetData();
});

function loadBudgetData() {
    // Load spending data for each budget
    const budgetRows = document.querySelectorAll('tbody tr');
    budgetRows.forEach(row => {
        const budgetId = row.querySelector('button').getAttribute('onclick').match(/\d+/)[0];
        const category = row.querySelector('.badge').textContent;
        loadCategorySpending(budgetId, category);
    });
}

function loadCategorySpending(budgetId, category) {
    // Get current month's spending for this category
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    let categoryPurchases
    fetch('/api/purchases')
        .then(response => response.json())
        .then(purchases => {
                if(category != 'Total'){
                    categoryPurchases = purchases.filter(p => 
                    p.category === category && 
                    new Date(p.date) >= currentMonth
                );
            }else {
               categoryPurchases = purchases.filter(p => new Date(p.date) >= currentMonth) 
            }
            
    const totalSpentCategory = categoryPurchases.reduce((sum, p) => sum + p.amount, 0);

    // Update the table
    document.getElementById(`spent-${budgetId}`).textContent = `$${totalSpentCategory.toFixed(2)}`;
    
    // Get budget amount from the table
    const budgetAmount = parseFloat(document.querySelector(`#spent-${budgetId}`).closest('tr').querySelector('td:nth-child(2) strong').textContent.replace('$', ''));
            const remaining = budgetAmount - totalSpentCategory;
            
            document.getElementById(`remaining-${budgetId}`).textContent = `$${remaining.toFixed(2)}`;
            
            // Update progress bar
            const percentage = Math.min((totalSpentCategory/ budgetAmount) * 100, 100);
            const progressBar = document.getElementById(`progress-${budgetId}`);
            const progressText = document.getElementById(`progress-text-${budgetId}`);
            
            progressBar.style.width = `${percentage}%`;
            progressText.textContent = `${percentage.toFixed(1)}%`;
            
            // Color coding based on percentage
            if (percentage >= 90) {
                progressBar.className = 'progress-bar bg-danger';
            } else if (percentage >= 75) {
                progressBar.className = 'progress-bar bg-warning';
            } else {
                progressBar.className = 'progress-bar bg-success';
            }
            
            // Update budget overview
            updateBudgetOverview();
        });
}

function updateBudgetOverview() {
    const budgetRows = document.querySelectorAll('tbody tr');
    const overviewContainer = document.getElementById('budgetOverview');
    
    let totalBudget = 0;
    let totalSpent = 0;
    
    budgetRows.forEach(row => {
        const budgetAmount = parseFloat(row.querySelector('td:nth-child(2) strong').textContent.replace('$', ''));
        const spentAmount = parseFloat(row.querySelector('td:nth-child(3)').textContent.replace('$', ''));
        
        totalBudget += budgetAmount;
        totalSpent += spentAmount;
    });
    
    const totalRemaining = totalBudget - totalSpent;
    const overallPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    
    overviewContainer.innerHTML = `
        <div class="col-md-3 mb-3">
            <div class="card stats-card">
                <div class="card-body text-center">
                    <div class="stats-number">$${totalBudget.toFixed(2)}</div>
                    <div class="stats-label">Total Budget</div>
                </div>
            </div>
        </div>
        <div class="col-md-3 mb-3">
            <div class="card stats-card">
                <div class="card-body text-center">
                    <div class="stats-number">$${totalSpent.toFixed(2)}</div>
                    <div class="stats-label">Total Spent</div>
                </div>
            </div>
        </div>
        <div class="col-md-3 mb-3">
            <div class="card stats-card">
                <div class="card-body text-center">
                    <div class="stats-number">$${totalRemaining.toFixed(2)}</div>
                    <div class="stats-label">Total Remaining</div>
                </div>
            </div>
        </div>
        <div class="col-md-3 mb-3">
            <div class="card stats-card">
                <div class="card-body text-center">
                    <div class="stats-number">${overallPercentage.toFixed(1)}%</div>
                    <div class="stats-label">Budget Used</div>
                </div>
            </div>
        </div>
    `;
}

function showCreateBudgetModal() {
    isEditMode = false;
    currentBudgetId = null;
    document.getElementById('budgetModalTitle').textContent = 'Create Budget';
    document.getElementById('budgetForm').reset();
    
    const modal = new bootstrap.Modal(document.getElementById('budgetModal'));
    modal.show();
}

function editBudget(budgetId, category, monthlyLimit) {
    isEditMode = true;
    currentBudgetId = budgetId;
    document.getElementById('budgetModalTitle').textContent = 'Edit Budget';
    document.getElementById('budgetCategory').value = category;
    document.getElementById('budgetAmount').value = monthlyLimit;
    
    const modal = new bootstrap.Modal(document.getElementById('budgetModal'));
    modal.show();
}

function saveBudget() {
    const category = document.getElementById('budgetCategory').value;
    const monthlyLimit = parseFloat(document.getElementById('budgetAmount').value);
    
    if (!category || !monthlyLimit) {
        showAlert('danger', 'Please fill in all fields');
        return;
    }
    
    if (isEditMode) {
        // Update existing budget
        fetch(`/api/budgets/${currentBudgetId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                category: category,
                monthly_limit: monthlyLimit
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert('success', 'Budget updated successfully');
                location.reload();
            } else {
                showAlert('danger', 'Error updating budget');
            }
        });
    } else {
        // Create new budget
        fetch('/api/budgets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                category: category,
                monthly_limit: monthlyLimit
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert('success', 'Budget created successfully');
                location.reload();
            } else {
                showAlert('danger', 'Error creating budget');
            }
        });
    }
}

function deleteBudget(budgetId) {
    if (confirm('Are you sure you want to delete this budget? This action cannot be undone.')) {
        fetch(`/api/budgets/${budgetId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert('success', 'Budget deleted successfully');
                location.reload();
            } else {
                showAlert('danger', 'Error deleting budget');
            }
        })
        .catch(error => {
            showAlert('danger', 'Error deleting budget: ' + error);
        });
    }
}
