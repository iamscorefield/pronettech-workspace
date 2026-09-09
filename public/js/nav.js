/**
 * Pronettech Workspace - Universal Navigation, Header Dropdown & Settings Modal
 * File: public/js/nav.js
 */

(function () {
    let activeUser = null;

    const navTemplate = `
    <!-- Top Sticky Header -->
    <header class="glass-card sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur px-4 sm:px-6 py-3.5 shadow-sm">
        <div class="max-w-7xl mx-auto flex justify-between items-center">
            <!-- Brand Logo -->
            <a id="nav-brand-logo" href="#" class="flex items-center gap-3 cursor-pointer group">
                <img src="/assets/images/logo.png" alt="Pronettech Logo" class="h-9 w-auto rounded-lg shadow-sm group-hover:opacity-90 transition-opacity">
                <div>
                    <h1 class="font-bold text-sm tracking-tight text-slate-900 leading-none">Pronettech <span class="text-pnt-purple">Workspace</span></h1>
                    <p id="nav-role-badge" class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Terminal</p>
                </div>
            </a>

            <!-- Desktop Links -->
            <div class="hidden md:flex items-center gap-6">
                <nav class="flex items-center gap-2" id="nav-desktop-links"></nav>

                <!-- Profile Dropdown Trigger -->
                <div class="relative">
                    <button id="nav-profile-trigger" type="button" class="flex items-center gap-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 py-1 px-3 rounded-full transition-all focus:outline-none cursor-pointer">
                        <div id="nav-avatar-box" class="w-7 h-7 rounded-full bg-pnt-purple text-white font-bold text-xs flex items-center justify-center overflow-hidden border border-purple-200 shrink-0">
                            <span id="nav-avatar-initials">--</span>
                        </div>
                        <span id="nav-username" class="text-xs font-semibold text-slate-800 max-w-[130px] truncate">Loading...</span>
                        <svg class="w-3.5 h-3.5 text-slate-400 transition-transform duration-200" id="dropdown-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>

                    <!-- Profile Dropdown Menu Card -->
                    <div id="nav-profile-dropdown" class="hidden absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 transition-all duration-200">
                        <div class="px-4 py-3 border-b border-slate-100 bg-slate-50/70">
                            <div class="flex items-center gap-2.5">
                                <div id="dropdown-avatar-box" class="w-9 h-9 rounded-full bg-pnt-purple text-white font-bold flex items-center justify-center text-xs overflow-hidden shrink-0 border border-purple-200">
                                    <span id="dropdown-initials">--</span>
                                </div>
                                <div class="overflow-hidden">
                                    <p id="dropdown-fullname" class="text-xs font-bold text-slate-900 truncate">User</p>
                                    <p id="dropdown-custom-id" class="text-[10px] font-mono text-pnt-purple font-semibold">PNT-PENDING</p>
                                </div>
                            </div>
                        </div>

                        <div class="py-1">
                            <button type="button" id="btn-open-settings-modal" class="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer">
                                <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                Account Settings & Bio
                            </button>

                            <a href="/views/team.html" class="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors">
                                <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                                Organization & Downlines
                            </a>
                        </div>

                        <div class="border-t border-slate-100 pt-1">
                            <button type="button" id="btn-dropdown-signout" class="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Mobile Hamburger Button -->
            <div class="flex items-center md:hidden gap-2">
                <button id="nav-mobile-hamburger" type="button" class="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all focus:outline-none">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                </button>
            </div>
        </div>

        <!-- Mobile Menu -->
        <div id="nav-mobile-menu" class="hidden md:hidden border-t border-slate-100 pt-3 pb-2 mt-2 space-y-2">
            <div id="nav-mobile-links" class="space-y-1"></div>
            <div class="border-t border-slate-100 pt-2 flex flex-col gap-1">
                <button type="button" id="btn-mobile-open-settings" class="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl text-left flex items-center gap-2">
                    ⚙️ Account Settings
                </button>
                <button type="button" id="btn-mobile-signout" class="px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl text-left flex items-center gap-2">
                    🚪 Sign Out
                </button>
            </div>
        </div>
    </header>

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

                        <button type="submit" id="pnt-save-profile-btn" class="w-full bg-pnt-purple hover:opacity-90 text-white font-semibold py-2 rounded-xl text-xs transition-all shadow-sm cursor-pointer">
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
                        <button type="submit" id="pnt-save-pwd-btn" class="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold py-2 rounded-xl text-xs transition-all shadow-sm cursor-pointer">
                            Update Password
                        </button>
                    </form>
                </div>
            </div>
        </div>
    </div>
    `;

    function initNavbar() {
        const existingNav = document.querySelector('nav');
        if (existingNav) existingNav.remove();

        const navWrapper = document.createElement('div');
        navWrapper.id = 'pnt-universal-nav-root';
        navWrapper.innerHTML = navTemplate;
        document.body.prepend(navWrapper);

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
        const trigger = document.getElementById('nav-profile-trigger');
        const dropdown = document.getElementById('nav-profile-dropdown');
        const chevron = document.getElementById('dropdown-chevron');
        const hamburger = document.getElementById('nav-mobile-hamburger');
        const mobileMenu = document.getElementById('nav-mobile-menu');

        const settingsModal = document.getElementById('pnt-settings-modal');
        const openSettingsBtn = document.getElementById('btn-open-settings-modal');
        const mobileSettingsBtn = document.getElementById('btn-mobile-open-settings');
        const closeSettingsBtn = document.getElementById('pnt-settings-close');

        const signoutBtn = document.getElementById('btn-dropdown-signout');
        const mobileSignoutBtn = document.getElementById('btn-mobile-signout');

        trigger?.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = dropdown.classList.contains('hidden');
            dropdown.classList.toggle('hidden');
            chevron?.classList.toggle('rotate-180', isHidden);
        });

        document.addEventListener('click', (e) => {
            if (dropdown && !dropdown.contains(e.target) && !trigger.contains(e.target)) {
                dropdown.classList.add('hidden');
                chevron?.classList.remove('rotate-180');
            }
        });

        hamburger?.addEventListener('click', () => {
            mobileMenu?.classList.toggle('hidden');
        });

        const openModal = () => {
            dropdown?.classList.add('hidden');
            chevron?.classList.remove('rotate-180');
            mobileMenu?.classList.add('hidden');
            settingsModal?.classList.remove('hidden');
        };

        const closeModal = () => {
            settingsModal?.classList.add('hidden');
        };

        openSettingsBtn?.addEventListener('click', openModal);
        mobileSettingsBtn?.addEventListener('click', openModal);
        closeSettingsBtn?.addEventListener('click', closeModal);

        settingsModal?.addEventListener('click', (e) => {
            if (e.target === settingsModal) closeModal();
        });

        const handleSignOut = () => {
            localStorage.removeItem('pnt_user');
            window.location.href = '/views/onboarding.html';
        };

        signoutBtn?.addEventListener('click', handleSignOut);
        mobileSignoutBtn?.addEventListener('click', handleSignOut);

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
            renderAvatar(document.getElementById('nav-avatar-box'), activeUser.avatar_url, initials);

            document.getElementById('dropdown-fullname').textContent = activeUser.name || 'User';
            document.getElementById('dropdown-custom-id').textContent = activeUser.customId || 'PNT-PENDING';
            renderAvatar(document.getElementById('dropdown-avatar-box'), activeUser.avatar_url, initials);

            document.getElementById('modal-fullname').textContent = activeUser.name || 'User';
            document.getElementById('modal-custom-id').textContent = activeUser.customId || 'PNT-PENDING';
            renderAvatar(document.getElementById('modal-avatar-box'), activeUser.avatar_url, initials);

            document.getElementById('pnt-edit-fname').value = activeUser.first_name || '';
            document.getElementById('pnt-edit-lname').value = activeUser.last_name || '';
            document.getElementById('pnt-edit-phone').value = activeUser.phone_number || '';
            document.getElementById('pnt-edit-state').value = activeUser.state || '';
            document.getElementById('pnt-edit-bio').value = activeUser.bio || '';

            const isAdmin = activeUser.role === 'admin' || activeUser.role === 'global_admin';
            const isLeader = activeUser.role === 'leader' || activeUser.role === 'team_leader';

            const roleFormatted = isAdmin ? 'GLOBAL ADMIN' : (isLeader ? 'TEAM LEADER' : 'WORKSPACE MEMBER');
            document.getElementById('nav-role-badge').textContent = roleFormatted;

            // Brand Logo Routing
            const brandLogo = document.getElementById('nav-brand-logo');
            if (brandLogo) {
                brandLogo.href = isAdmin ? '/views/admin.html' : (isLeader ? '/views/leader.html' : '/views/dashboard.html');
            }

            renderRoleNavigation(activeUser);
        } catch (err) {
            console.warn('Nav sync error:', err.message);
        }
    }

    function renderRoleNavigation(user) {
        const desktopContainer = document.getElementById('nav-desktop-links');
        const mobileContainer = document.getElementById('nav-mobile-links');
        if (!desktopContainer || !mobileContainer) return;

        desktopContainer.innerHTML = '';
        mobileContainer.innerHTML = '';

        const links = [];
        const isAdmin = user.role === 'admin' || user.role === 'global_admin';
        const isLeader = user.role === 'leader' || user.role === 'team_leader';

        if (isAdmin) {
            // ADMIN NAVIGATION: Lands on Command Overview, no Member Terminal
            links.push({ label: 'Overview', href: '/views/admin.html' });
            links.push({ label: 'Organization & Network', href: '/views/team.html' });
        } else if (isLeader) {
            // LEADER NAVIGATION: Leader Desk, Attendance Terminal & Team
            links.push({ label: 'Leader Terminal', href: '/views/leader.html' });
            links.push({ label: 'My Attendance & ID', href: '/views/attendance.html' });
            links.push({ label: 'Team & Downlines', href: '/views/team.html' });
        } else {
            // MEMBER NAVIGATION: Member Desk & Downlines
            links.push({ label: 'Overview', href: '/views/dashboard.html' });
            links.push({ label: 'Team & Downlines', href: '/views/team.html' });
        }

        const currentPath = window.location.pathname;

        links.forEach(link => {
            const isCurrent = currentPath.endsWith(link.href.split('/').pop());

            const a = document.createElement('a');
            a.href = link.href;
            a.className = isCurrent
                ? "px-3.5 py-1.5 text-xs font-bold text-pnt-purple bg-purple-50 rounded-lg transition-all border border-purple-100"
                : "px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg transition-all";
            a.textContent = link.label;
            desktopContainer.appendChild(a);

            const mobA = document.createElement('a');
            mobA.href = link.href;
            mobA.className = isCurrent
                ? "block px-4 py-2 text-xs font-bold text-pnt-purple bg-purple-50 rounded-xl"
                : "block px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-xl";
            mobA.textContent = link.label;
            mobileContainer.appendChild(mobA);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNavbar);
    } else {
        initNavbar();
    }
})();