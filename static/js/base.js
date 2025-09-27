function syncGmail() {
    const button = document.getElementById("autoSyncStatus")
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
    button.style.pointerEvents = 'none';
    fetch('/sync-gmail')
    .then(response => response.json())
    .then(data => {
    if (data.success) {
        // Show success message
        showAlert('success', data.message);
        // Reload the page to show updated data
    } else {
        showAlert('danger', 'Error: ' + data.error);
    }
    })
    .catch(error => {
        showAlert('danger', 'Error syncing: ' + error);
    })
    .finally(() => {
        button.innerHTML = "";
        button.style.pointerEvents = 'auto';
        button.remove()
    });
}

function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const container = document.querySelector('.main-content');
    container.insertBefore(alertDiv, container.firstChild);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
    if (alertDiv.parentNode) {
        alertDiv.remove();
    }
    }, 5000);
}
    
