document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    const loginOverlay = document.getElementById('login-overlay');
    const loginForm = document.getElementById('login-form');
    const passwordInput = document.getElementById('admin-password');
    const loginError = document.getElementById('login-error');
    const dashboard = document.getElementById('admin-dashboard');
    const logoutBtn = document.getElementById('logout-btn');
    const saveBtn = document.getElementById('save-btn');
    const saveStatus = document.getElementById('save-status');

    let cmsData = {
        services: [],
        products: [],
        team: [],
        blogs: [],
        partners: []
    };

    let currentPassword = sessionStorage.getItem('cms_admin_password') || null;

    // ----- Authentication -----
    if (currentPassword) {
        // Optimistically login, will fail on load if invalid
        loginOverlay.classList.add('hidden');
        dashboard.classList.remove('hidden');
        fetchData();
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pwd = passwordInput.value;
        const success = await testLogin(pwd);
        if (success) {
            currentPassword = pwd;
            sessionStorage.setItem('cms_admin_password', pwd);
            loginOverlay.classList.add('hidden');
            dashboard.classList.remove('hidden');
            loginError.classList.add('hidden');
            fetchData();
        } else {
            loginError.classList.remove('hidden');
        }
    });

    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('cms_admin_password');
        currentPassword = null;
        dashboard.classList.add('hidden');
        loginOverlay.classList.remove('hidden');
        passwordInput.value = '';
    });

    async function testLogin(pwd) {
        // Quick test against the post endpoint with an empty object to check auth
        try {
            const res = await fetch('/api/content', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': pwd
                },
                body: JSON.stringify(cmsData) // send current (empty or stale) data just to test auth
            });
            return res.ok;
        } catch (e) {
            return false;
        }
    }


    // ----- Data Fetching & Rendering -----
    async function fetchData() {
        try {
            const res = await fetch('/api/content');
            if (res.ok) {
                cmsData = await res.json();
                renderAll();
            } else {
                alert("Failed to fetch CMS content. Please check server.");
            }
        } catch (e) {
            console.error("Error fetching data:", e);
        }
    }

    function renderAll() {
        renderList('services', cmsData.services, ['icon', 'title']);
        renderList('products', cmsData.products, ['title', 'badge', 'desc']);
        renderList('team', cmsData.team, ['name', 'role', 'image']);
        renderList('blogs', cmsData.blogs, ['title', 'author', 'date', 'image']);
        renderList('partners', cmsData.partners, ['name', 'image']);
        lucide.createIcons();
    }

    function renderList(type, items, keys) {
        const container = document.getElementById(`list-${type}`);
        if (!container) return;
        container.innerHTML = '';

        items.forEach((item, index) => {
            // Build simple preview summary based on type keys
            const previewHtml = keys.map(k => {
                if (k === 'image' && item[k]) return `<img src="${item[k]}" class="w-10 h-10 rounded object-cover mb-2 border">`;
                if (k === 'icon') return `<div class="text-brand-gold mb-2"><i data-lucide="${item[k]}" class="w-5 h-5"></i></div>`;
                return `<div class="text-sm truncate ${k === keys[0] ? 'font-bold text-brand-navy text-lg' : 'text-slate-500'}">${item[k] || ''}</div>`;
            }).join('');

            const card = document.createElement('div');
            card.className = "bg-white border text-left border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative group";
            card.innerHTML = `
                <div class="flex flex-col h-full">
                    <div class="flex-1 mb-4 overflow-hidden">
                        ${previewHtml}
                    </div>
                    <div class="flex items-center gap-2 pt-4 border-t border-slate-100 mt-auto">
                        <button class="btn-edit flex-1 text-center py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 font-medium text-sm transition-colors" data-type="${type}" data-id="${item.id}">Edit</button>
                        <button class="btn-delete px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors" data-type="${type}" data-id="${item.id}"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    // ----- Tab Switching -----
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target;

            // reset all buttons
            document.querySelectorAll('.tab-btn').forEach(b => {
                b.className = "tab-btn w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg text-slate-600 hover:bg-slate-50 transition-colors";
            });
            // highlight active button
            e.currentTarget.className = "tab-btn w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg bg-brand-navy/5 text-brand-navy font-semibold transition-colors";

            // hide all contents
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            // show target content
            document.getElementById(`tab-${target}`).classList.remove('hidden');
        });
    });


    // ----- Modal Logic -----
    const modal = document.getElementById('edit-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');
    const modalClose = document.getElementById('modal-close');
    const modalCancel = document.getElementById('modal-cancel');

    let currentEditType = null;
    let currentEditId = null;

    // Form Definitions for each type
    const schemas = {
        services: [
            { key: 'title', label: 'Service Title', type: 'text' },
            { key: 'icon', label: 'Lucide Icon Name (e.g. globe, layout)', type: 'text' }
        ],
        products: [
            { key: 'title', label: 'Product Name', type: 'text' },
            { key: 'badge', label: 'Badge (LIVE or CONCEPT)', type: 'text' },
            { key: 'desc', label: 'Description', type: 'textarea' }
        ],
        team: [
            { key: 'name', label: 'Full Name', type: 'text' },
            { key: 'role', label: 'Role / Position', type: 'text' },
            { key: 'image', label: 'Image URL (images/team/filename.png)', type: 'text' }
        ],
        blogs: [
            { key: 'title', label: 'Blog Title', type: 'text' },
            { key: 'author', label: 'Author Name', type: 'text' },
            { key: 'date', label: 'Date', type: 'text' },
            { key: 'image', label: 'Cover Image URL', type: 'text' }
        ],
        partners: [
            { key: 'name', label: 'Partner Name', type: 'text' },
            { key: 'image', label: 'Logo URL', type: 'text' }
        ]
    };

    function openModal(type, id = null) {
        currentEditType = type;
        currentEditId = id;
        modalTitle.textContent = id ? `Edit ${type.slice(0, -1)}` : `Add New ${type.slice(0, -1)}`;

        let itemData = {};
        if (id) {
            itemData = cmsData[type].find(i => i.id === id) || {};
        }

        const schema = schemas[type];
        modalBody.innerHTML = schema.map(field => {
            const val = itemData[field.key] || '';
            if (field.type === 'textarea') {
                return `
                    <div class="flex flex-col gap-1">
                        <label class="text-sm font-semibold text-slate-700">${field.label}</label>
                        <textarea id="field-${field.key}" rows="3" class="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-brand-gold">${val}</textarea>
                    </div>
                `;
            }
            return `
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-semibold text-slate-700">${field.label}</label>
                    <input type="text" id="field-${field.key}" value="${val}" class="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-brand-gold">
                </div>
            `;
        }).join('');

        modal.classList.remove('hidden');
    }

    function closeModal() {
        modal.classList.add('hidden');
        currentEditType = null;
        currentEditId = null;
    }

    modalClose.addEventListener('click', closeModal);
    modalCancel.addEventListener('click', closeModal);

    modalSave.addEventListener('click', () => {
        if (!currentEditType) return;

        const schema = schemas[currentEditType];
        const newData = {
            id: currentEditId || Date.now().toString() // generate ID if new
        };

        schema.forEach(field => {
            newData[field.key] = document.getElementById(`field-${field.key}`).value;
        });

        if (currentEditId) {
            // Update existing
            const index = cmsData[currentEditType].findIndex(i => i.id === currentEditId);
            if (index > -1) cmsData[currentEditType][index] = newData;
        } else {
            // Add new
            cmsData[currentEditType].push(newData);
        }

        renderAll();
        closeModal();
    });

    // Event Delegation for dynamically created Edit/Delete/Add buttons
    document.body.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit');
        if (editBtn) openModal(editBtn.dataset.type, editBtn.dataset.id);

        const addBtn = e.target.closest('.btn-add');
        if (addBtn) openModal(addBtn.dataset.type);

        const delBtn = e.target.closest('.btn-delete');
        if (delBtn) {
            const type = delBtn.dataset.type;
            const id = delBtn.dataset.id;
            if (confirm('Are you sure you want to delete this item?')) {
                cmsData[type] = cmsData[type].filter(i => i.id !== id);
                renderAll();
            }
        }
    });

    // ----- Save All Changes to Server -----
    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Saving...';
        lucide.createIcons();

        try {
            // Save each category separately to the new Supabase API structure
            const categories = ['services', 'products', 'team', 'blogs', 'partners'];
            let allSuccess = true;

            for (const type of categories) {
                const res = await fetch('/api/content', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': currentPassword
                    },
                    body: JSON.stringify({ type: type, items: cmsData[type] })
                });

                if (!res.ok) {
                    allSuccess = false;
                    console.error(`Failed to save ${type}`);
                }
            }

            if (allSuccess) {
                saveStatus.classList.remove('hidden');
                setTimeout(() => saveStatus.classList.add('hidden'), 3000);
            } else {
                alert("Failed to save some changes. Check server logs.");
            }
        } catch (e) {
            console.error(e);
            alert("Network Error saving changes.");
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Save All Changes';
            lucide.createIcons();
        }
    });

});
