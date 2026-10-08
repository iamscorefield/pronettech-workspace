/**
 * Pronettech Workspace - Universal Collapsible Sidebar Navigation & Settings Modal
 * File: public/js/nav.js
 */

(function () {
    let activeUser = null;

    const sidebarTemplate = `
    <!-- Mobile Top Header Bar -->
    <header class="lg:hidden sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-xs">
        <a id="mobile-nav-brand-logo" href="#" class="flex items-center gap-2.5">
            <img src="/assets/images/logo.png" alt="Pronettech" class="h-8 w-auto rounded-lg shadow-xs">
            <div>
                <h1 class="font-bold text-xs tracking-tight text-slate-900 leading-none">Pronettech <span class="text-pnt-purple">Workspace</span></h1>
                <p id="mobile-nav-role-badge" class="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Terminal</p>
            </div>
        </a>

        <button id="pnt-sidebar-open-btn" type="button" class="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer focus:outline-none" aria-label="Open Navigation">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
        </button>
    </header>

    <!-- Mobile Dimmed Backdrop Overlay -->
    <div id="pnt-sidebar-backdrop" class="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 hidden transition-opacity duration-300"></div>

    <!-- Collapsible Sidebar Container -->
    <aside id="pnt-sidebar" class="fixed top-0 bottom-0 left-0 w-64 bg-white border-r border-slate-200 z-50 flex flex-col justify-between transform -translate-x-full lg:translate-x-0 transition-transform duration-300 ease-in-out shadow-xl lg:shadow-none">
        
        <!-- Sidebar Header / Logo -->
        <div class="p-5 border-b border-slate-100">
            <div class="flex items-center justify-between">
                <a id="nav-brand-logo" href="#" class="flex items-center gap-3 group">
                    <img src="/assets/images/logo.png" alt="Pronettech" class="h-9 w-auto rounded-lg shadow-xs group-hover:opacity-90 transition-opacity">
                    <div>
                        <h2 class="font-bold text-sm tracking-tight text-slate-900 leading-none">Pronettech <span class="text-pnt-purple">Workspace</span></h2>
                        <span id="nav-role-badge" class="inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-pnt-purple border border-purple-100 uppercase tracking-wider">Terminal</span>
                    </div>
                </a>

                <!-- Mobile Close Button -->
                <button id="pnt-sidebar-close-btn" type="button" class="lg:hidden p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        </div>

        <!-- Sidebar Navigation Links (Role Specific) -->
        <div class="flex-1 overflow-y-auto px-3.5 py-4 space-y-1.5" id="sidebar-nav-links">
            <div class="text-xs text-slate-400 px-3 py-2">Loading workspace links...</div>
        </div>

        <!-- Sidebar User Footer Card & Actions -->
        <div class="p-3.5 border-t border-slate-100 bg-slate-50/70 space-y-2">
            <div class="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                <div id="nav-avatar-box" class="w-9 h-9 rounded-full bg-pnt-purple text-white font-bold text-xs flex items-center justify-center overflow-hidden border border-purple-200 shrink-0">
                    <span id="nav-avatar-initials">--</span>
                </div>
                <div class="overflow-hidden flex-1 min-w-0">
                    <p id="nav-username" class="text-xs font-bold text-slate-900 truncate">User</p>
                    <p id="nav-custom-id" class="text-[10px] font-mono text-pnt-purple font-semibold truncate">PNT-PENDING</p>
                </div>
            </div>

            <button type="button" id="btn-sidebar-open-settings" class="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-white hover:text-pnt-purple rounded-xl flex items-center gap-2.5 transition-all cursor-pointer">
                <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                Account Settings
            </button>

            <button type="button" id="btn-sidebar-signout" class="w-full text-left px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2.5 transition-all cursor-pointer">
                <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
                Sign Out
            </button>
        </div>
    </aside>

    <!-- POPUP MODAL: PROFILE & PASSWORD SETTINGS -->
    <div id="pnt-settings-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 hidden flex items-center justify-center p-4">
        <div class="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div class="flex items-center gap-3">
                    <div id="modal-avatar-box" class="w-10 h-10 rounded-full bg-pnt-purple text-white font-bold flex items-center justify-center text-sm overflow-hidden shrink-0 border border-purple-200">
                        <span id="modal-initials">--</span>
                    </div>
                    <div>
                        <h3 id="modal-fullname" class="text-sm font-bold text-slate-900 leading-tight">Account Settings</h3>
                        <p id="modal-custom-id" class="text-[11px] font-mono text-pnt-purple font-semibold">PNT-PENDING</p>
                    </div>
                </div>
                <button type="button" id="pnt-settings-close" class="text-slate-400 hover:text-slate-700 text-xl font-bold leading-none p-1 cursor-pointer">&times;</button>
            </div>

            <div class="overflow-y-auto p-6 space-y-6 flex-1">
                <div>
                    <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Identity Details</h4>
                    <form id="pnt-profile-form" class="space-y-3.5">
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-[11px] font-semibold text-slate-600 mb-1">First Name</label>
                                <input type="text" id="pnt-edit-fname" required class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-pnt-purple">
                            </div>
                            <div>
                                <label class="block text-[11px] font-semibold text-slate-600 mb-1">Last Name</label>
                                <input type="text" id="pnt-edit-lname" required class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-pnt-purple">
                            </div>
                        </div>

                        <div>
                            <label class="block text-[11px] font-semibold text-slate-600 mb-1">Phone Number</label>
                            <input type="tel" id="pnt-edit-phone" required class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-pnt-purple">
                        </div>

                        <div>
                            <label class="block text-[11px] font-semibold text-slate-600 mb-1">State of Residence</label>
                            <input type="text" id="pnt-edit-state" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-pnt-purple" placeholder="e.g. Lagos, Ogun...">
                        </div>

                        <div>
                            <label class="block text-[11px] font-semibold text-slate-600 mb-1">Personal Bio</label>
                            <textarea id="pnt-edit-bio" rows="2" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-pnt-purple" placeholder="Executive bio or role summary..."></textarea>
                        </div>

                        <button type="submit" id="pnt-save-profile-btn" class="w-full bg-pnt-purple hover:opacity-90 text-white font-semibold py-2.5 rounded-xl text-xs transition-all shadow-sm cursor-pointer">
                            Save Profile Details
                        </button>
                    </form>
                </div>

                <div class="border-t border-slate-100 pt-5">
                    <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Change Password</h4>
                    <form id="pnt-password-form" class="space-y-3">
                        <div>
                            <label class="block text-[11px] font-semibold text-slate-600 mb-1">Current Password</label>
                            <input type="password" id="pnt-current-pwd" required placeholder="••••••••" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-pnt-purple">
                        </div>
                        <div>
                            <label class="block text-[11px] font-semibold text-slate-600 mb-1">New Password (min 6 chars)</label>
                            <input type="password" id="pnt-new-pwd" required minlength="6" placeholder="••••••••" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-pnt-purple">
                        </div>
                        <button type="submit" id="pnt-save-pwd-btn" class="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold py-2.5 rounded-xl text-xs transition-all shadow-sm cursor-pointer">
                            Update Password
                        </button>
                    </form>
                </div>
            </div>
        </div>
    </div>
    `;

    function initSidebar() {
        const existingRoot = document.getElementById('pnt-universal-nav-root');
        if (existingRoot) existingRoot.remove();

        const navWrapper = document.createElement('div');
        navWrapper.id = 'pnt-universal-nav-root';
        navWrapper.innerHTML = sidebarTemplate;
        document.body.prepend(navWrapper);

        document.body.classList.add('lg:pl-64');

        bindEvents();
        fetchSessionAndPopulate();
    }

    function renderAvatar(containerEl, avatarUrl, initials) {
        if (!containerEl) return;
        if (avatarUrl) {
            containerEl.innerHTML = `<img src="${avatarUrl}" alt="Avatar" class="w-full h-full object-cover">`;
        } else {
            containerEl.innerHTML = `<span class="font-bold text-xs">${initials || 'U'}</span>`;
        }
    }

    function bindEvents() {
        const sidebar = document.getElementById('pnt-sidebar');
        const backdrop = document.getElementById('pnt-sidebar-backdrop');
        const openBtn = document.getElementById('pnt-sidebar-open-btn');
        const closeBtn = document.getElementById('pnt-sidebar-close-btn');

        const openSidebar = () => {
            sidebar?.classList.remove('-translate-x-full');
            backdrop?.classList.remove('hidden');
        };

        const closeSidebar = () => {
            sidebar?.classList.add('-translate-x-full');
            backdrop?.classList.add('hidden');
        };

        openBtn?.addEventListener('click', openSidebar);
        closeBtn?.addEventListener('click', closeSidebar);
        backdrop?.addEventListener('click', closeSidebar);

        const settingsModal = document.getElementById('pnt-settings-modal');
        const openSettingsBtn = document.getElementById('btn-sidebar-open-settings');
        const closeSettingsBtn = document.getElementById('pnt-settings-close');

        const openModal = () => {
            closeSidebar();
            settingsModal?.classList.remove('hidden');
        };

        const closeModal = () => {
            settingsModal?.classList.add('hidden');
        };

        openSettingsBtn?.addEventListener('click', openModal);
        closeSettingsBtn?.addEventListener('click', closeModal);

        settingsModal?.addEventListener('click', (e) => {
            if (e.target === settingsModal) closeModal();
        });

        const handleSignOut = () => {
            localStorage.removeItem('pnt_user');
            window.location.href = '/views/onboarding.html';
        };

        document.getElementById('btn-sidebar-signout')?.addEventListener('click', handleSignOut);

        document.getElementById('pnt-profile-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('pnt-save-profile-btn');
            btn.disabled = true;
            btn.textContent = 'Updating...';

            const payload = {
                first_name: document.getElementById('pnt-edit-fname').value.trim(),
                last_name: document.getElementById('pnt-edit-lname').value.trim(),
                phone_number: document.getElementById('pnt-edit-phone').value.trim(),
                state: document.getElementById('pnt-edit-state').value.trim(),
                bio: document.getElementById('pnt-edit-bio').value.trim()
            };

            try {
                const res = await fetch('/api/auth/profile/update', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    alert('Profile details updated successfully!');
                    closeModal();
                    fetchSessionAndPopulate();
                } else {
                    alert(`Failed: ${data.message}`);
                }
            } catch (err) {
                alert('Connection error.');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Save Profile Details';
            }
        });

        document.getElementById('pnt-password-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('pnt-save-pwd-btn');
            const current_password = document.getElementById('pnt-current-pwd').value;
            const new_password = document.getElementById('pnt-new-pwd').value;

            btn.disabled = true;
            btn.textContent = 'Updating...';

            try {
                const res = await fetch('/api/auth/profile/password', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ current_password, new_password })
                });
                const data = await res.json();
                if (data.success) {
                    alert('Password successfully updated!');
                    document.getElementById('pnt-password-form').reset();
                    closeModal();
                } else {
                    alert(`Error: ${data.message}`);
                }
            } catch (err) {
                alert('Connection error.');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Update Password';
            }
        });
    }

    async function fetchSessionAndPopulate() {
        try {
            const res = await fetch('/api/auth/me', { credentials: 'include' });
            const data = await res.json();

            if (!data.success) return;

            activeUser = data.user;
            localStorage.setItem('pnt_user', JSON.stringify(activeUser));

            const initials = `${activeUser.first_name?.[0] || ''}${activeUser.last_name?.[0] || ''}`.toUpperCase() || 'U';

            document.getElementById('nav-username').textContent = activeUser.name || 'User';
            document.getElementById('nav-custom-id').textContent = activeUser.customId || 'PNT-PENDING';
            renderAvatar(document.getElementById('nav-avatar-box'), activeUser.avatar_url, initials);

            document.getElementById('modal-fullname').textContent = activeUser.name || 'User';
            document.getElementById('modal-custom-id').textContent = activeUser.customId || 'PNT-PENDING';
            renderAvatar(document.getElementById('modal-avatar-box'), activeUser.avatar_url, initials);

            document.getElementById('pnt-edit-fname').value = activeUser.first_name || '';
            document.getElementById('pnt-edit-lname').value = activeUser.last_name || '';
            document.getElementById('pnt-edit-phone').value = activeUser.phone_number || '';
            document.getElementById('pnt-edit-state').value = activeUser.state || '';
            document.getElementById('pnt-edit-bio').value = activeUser.bio || '';

            const isAdmin = activeUser.role === 'admin' || activeUser.role === 'global_admin';
            const isLeader = activeUser.role === 'leader' || activeUser.role === 'team_leader' || activeUser.role === 'sub_admin';

            const roleFormatted = isAdmin ? 'GLOBAL ADMIN' : (activeUser.role === 'sub_admin' ? 'SUB-ADMIN' : (isLeader ? 'TEAM LEADER' : 'WORKSPACE MEMBER'));
            document.getElementById('nav-role-badge').textContent = roleFormatted;
            const mobileRoleBadge = document.getElementById('mobile-nav-role-badge');
            if (mobileRoleBadge) mobileRoleBadge.textContent = roleFormatted;

            const targetHome = isAdmin ? '/views/admin.html' : (isLeader ? '/views/leader.html' : '/views/dashboard.html');
            const brandLogo = document.getElementById('nav-brand-logo');
            const mobileBrandLogo = document.getElementById('mobile-nav-brand-logo');
            if (brandLogo) brandLogo.href = targetHome;
            if (mobileBrandLogo) mobileBrandLogo.href = targetHome;

            renderRoleNavigation(activeUser);
        } catch (err) {
            console.warn('Nav sync note:', err.message);
        }
    }

    function renderRoleNavigation(user) {
        const container = document.getElementById('sidebar-nav-links');
        if (!container) return;

        container.innerHTML = '';

        const links = [];
        const isAdmin = user.role === 'admin' || user.role === 'global_admin';
        const isLeader = user.role === 'leader' || user.role === 'team_leader' || user.role === 'sub_admin';

        if (isAdmin) {
            links.push({
                label: 'Overview Command',
                href: '/views/admin.html',
                icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>`
            });
            links.push({
                label: 'Organization Roster',
                href: '/views/team.html',
                icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`
            });
            links.push({
                label: 'Offices & Hubs',
                href: '/views/offices.html',
                icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>`
            });
            links.push({
                label: 'Financial Ledger',
                href: '/views/finance.html',
                icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
            });
            links.push({
                label: 'Attendance Stream',
                href: '/views/attendance.html',
                icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
            });
            links.push({
                label: 'Announcements',
                href: '/views/announcements.html',
                icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>`
            });
            links.push({
                label: 'Help Desk Community',
                href: '/views/community.html',
                icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 012 2h2v4l.586-.586z"/></svg>`
            });
        } else if (isLeader) {
            links.push({
                label: 'Leader Terminal',
                href: '/views/leader.html',
                icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`
            });
            links.push({
                label: 'Team & Downlines',
                href: '/views/team.html',
                icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`
            });
            links.push({
                label: 'Announcements',
                href: '/views/announcements.html',
                icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>`
            });
            links.push({
                label: 'Community Forum',
                href: '/views/community.html',
                icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 012 2h2v4l.586-.586z"/></svg>`
            });
        } else {
            links.push({
                label: 'Member Dashboard',
                href: '/views/dashboard.html',
                icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>`
            });
            links.push({
                label: 'My Team & Downlines',
                href: '/views/team.html',
                icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`
            });
            links.push({
                label: 'Community Forum',
                href: '/views/community.html',
                icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 012 2h2v4l.586-.586z"/></svg>`
            });
            links.push({
                label: 'Announcements',
                href: '/views/announcements.html',
                icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>`
            });
        }

        const currentPath = window.location.pathname;

        links.forEach(link => {
            const isCurrent = currentPath.endsWith(link.href.split('/').pop());

            const a = document.createElement('a');
            a.href = link.href;
            a.className = isCurrent
                ? "flex items-center gap-3 px-3.5 py-2.5 text-xs font-bold text-pnt-purple bg-purple-50 rounded-xl border border-purple-200 shadow-2xs transition-all"
                : "flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all";
            
            a.innerHTML = `
                <span class="${isCurrent ? 'text-pnt-purple' : 'text-slate-400'}">${link.icon}</span>
                <span class="truncate">${link.label}</span>
            `;

            container.appendChild(a);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSidebar);
    } else {
        initSidebar();
    }
})();