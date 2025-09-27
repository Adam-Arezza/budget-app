function showCreateRuleModal() {
    document.getElementById('createRuleForm').reset();
    const modal = new bootstrap.Modal(document.getElementById('createRuleModal'));
    modal.show();
}

function saveRule() {
    const merchantPattern = document.getElementById('merchantPattern').value;
    const descriptionPattern = document.getElementById('descriptionPattern').value;
    const category = document.getElementById('ruleCategory').value;
    const priority = parseInt(document.getElementById('rulePriority').value) || 1;
    
    if (!merchantPattern || !category) {
        showAlert('warning', 'Please fill in all required fields');
        return;
    }
    
    fetch('/api/category-rules', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            merchant_pattern: merchantPattern,
            description_pattern: descriptionPattern || null,
            category: category,
            priority: priority
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert('success', 'Category rule created successfully');
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('createRuleModal'));
            modal.hide();
            // Reload page to show new rule
            setTimeout(() => location.reload(), 1000);
        } else {
            showAlert('danger', 'Error creating rule: ' + data.error);
        }
    })
    .catch(error => {
        showAlert('danger', 'Error creating rule: ' + error);
    });
}

function deleteRule(ruleId) {
    if (confirm('Are you sure you want to delete this category rule? This action cannot be undone.')) {
        fetch(`/api/category-rules/${ruleId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert('success', 'Category rule deleted successfully');
                location.reload();
            } else {
                showAlert('danger', 'Error deleting rule: ' + data.error);
            }
        })
        .catch(error => {
            showAlert('danger', 'Error deleting rule: ' + error);
        });
    }
}
