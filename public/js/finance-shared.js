/**
 * Pronettech Workspace - Shared Finance Utilities
 * File: public/js/finance-shared.js
 */

function formatNaira(amount) {
    return '₦' + Number(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function handleImagePreview(inputEl, previewContainerEl) {
    const file = inputEl.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit.');
        inputEl.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        previewContainerEl.innerHTML = `<img src="${e.target.result}" class="w-full h-32 object-cover rounded-xl border border-slate-200">`;
        previewContainerEl.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}