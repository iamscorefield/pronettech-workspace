/**
 * ProNet-Tech Space - Universal Collapsible Sidebar Navigation & Settings Modal
 * File: public/js/nav.js
 */

(function () {
    let activeUser = null;
    let activeRecipientId = null;
    let contactsList = [];
    let chatPollingInterval = null;
    let globalUnreadPollInterval = null;
    let moduleBadgesPollInterval = null;

    // Cropper runtime state variables
    let cropperImageObj = null;
    let cropperScale = 1;
    let cropperOffsetX = 0;
    let cropperOffsetY = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    const nigerianStates = [
        "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", 
        "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT - Abuja", "Gombe", 
        "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", 
        "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", 
        "Taraba", "Yobe", "Zamfara"
    ];

    const sidebarTemplate = `
    <!-- Mobile Top Header Bar -->
    <header class="lg:hidden sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-xs">
        <a id="mobile-nav-brand-logo" href="#" class="flex items-center gap-2.5">
            <img src="/assets/images/logo.png" alt="ProNet-Tech" class="h-8 w-auto rounded-lg shadow-xs">
            <div>
                <h1 class="font-bold text-xs tracking-tight text-slate-900 leading-none">ProNet-Tech <span class="text-pnt-purple">Space</span></h1>
                <p id="mobile-nav-role-badge" class="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Terminal</p>
            </div>
        </a>

        <div class="flex items-center gap-1">
            <button id="pnt-mobile-chat-toggle" type="button" class="p-2 text-pnt-purple hover:bg-purple-50 rounded-xl transition-all cursor-pointer relative" aria-label="Open Direct Messages">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                <span id="mobile-global-unread-badge" class="absolute top-1 right-1 hidden bg-red-500 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center shadow-xs animate-pulse">0</span>
            </button>
            <button id="pnt-sidebar-open-btn" type="button" class="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer focus:outline-none" aria-label="Open Navigation">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
            </button>
        </div>
    </header>

    <!-- Mobile Dimmed Backdrop Overlay -->
    <div id="pnt-sidebar-backdrop" class="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 hidden transition-opacity duration-300"></div>

    <!-- Collapsible Sidebar Container -->
    <aside id="pnt-sidebar" class="fixed top-0 bottom-0 left-0 w-64 bg-white border-r border-slate-200 z-50 flex flex-col justify-between transform -translate-x-full lg:translate-x-0 transition-transform duration-300 ease-in-out shadow-xl lg:shadow-none">
        
        <!-- Sidebar Header / Logo -->
        <div class="p-5 border-b border-slate-100">
            <div class="flex items-center justify-between">
                <a id="nav-brand-logo" href="#" class="flex items-center gap-3 group">
                    <img src="/assets/images/logo.png" alt="ProNet-Tech" class="h-9 w-auto rounded-lg shadow-xs group-hover:opacity-90 transition-opacity">
                    <div>
                        <h2 class="font-bold text-sm tracking-tight text-slate-900 leading-none">ProNet-Tech <span class="text-pnt-purple">Space</span></h2>
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

    <!-- GLOBAL BRANDED NOTIFICATION MODAL OVERLAY -->
    <div id="pnt-global-alert-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[100] hidden flex items-center justify-center p-4">
        <div class="bg-white border border-slate-200 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col p-6 text-center space-y-4">
            <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pnt-purple to-pnt-orange text-white mx-auto flex items-center justify-center shadow-lg shadow-pnt-purple/20 p-2.5">
                <img src="/assets/images/logo.png" alt="ProNet-Tech" class="w-full h-full object-contain rounded-xl">
            </div>
            <div>
                <h3 id="pnt-global-alert-title" class="text-base font-black text-pnt-dark">ProNet-Tech Space</h3>
                <p id="pnt-global-alert-message" class="text-xs text-slate-600 mt-1.5 leading-relaxed">Notification message goes here...</p>
            </div>
            <div class="pt-2 flex justify-center">
                <button type="button" id="pnt-global-alert-btn" class="px-6 py-2 btn-brand-gradient text-xs font-bold text-white rounded-xl shadow-md transition-all cursor-pointer">
                    Understood
                </button>
            </div>
        </div>
    </div>

    <!-- FLOATING CHAT SLIDE-OVER DRAWER -->
    <div id="pnt-chat-drawer" class="fixed inset-0 z-50 hidden flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity">
        <div class="bg-white w-full max-w-md h-full shadow-2xl flex flex-col border-l border-slate-200 transform transition-transform duration-300">
            <!-- Drawer Header -->
            <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-full bg-purple-100 text-pnt-purple flex items-center justify-center font-bold text-xs">💬</div>
                    <div>
                        <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider">Direct Messages</h3>
                        <p class="text-[10px] text-slate-500">Secure 1-on-1 Workspace Chat</p>
                    </div>
                </div>
                <button type="button" id="pnt-chat-close-btn" class="w-7 h-7 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 font-bold flex items-center justify-center cursor-pointer">&times;</button>
            </div>

            <!-- Drawer Body -->
            <div class="flex-1 flex flex-col overflow-hidden">
                <!-- Contacts List View -->
                <div id="chat-contacts-view" class="flex-1 flex flex-col h-full">
                    <div class="p-3 border-b border-slate-100 bg-white">
                        <input type="text" id="drawer-contact-search" placeholder="Search contacts..." class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-pnt-purple">
                    </div>
                    <div id="drawer-contacts-list" class="overflow-y-auto flex-1 divide-y divide-slate-100">
                        <div class="p-6 text-center text-xs text-slate-400">Loading contacts...</div>
                    </div>
                </div>

                <!-- Active Chat Conversation View (Initially Hidden) -->
                <div id="chat-conversation-view" class="flex-1 flex flex-col h-full hidden">
                    <div class="p-3 border-b border-slate-200 bg-white flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <button type="button" id="back-to-contacts-btn" class="text-xs font-bold text-pnt-purple hover:underline flex items-center gap-1 cursor-pointer">← Back</button>
                            <div class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs overflow-hidden shrink-0 cursor-pointer hover:scale-105 transition-transform" id="drawer-active-avatar" title="Inspect Profile">?</div>
                            <div class="overflow-hidden">
                                <h4 id="drawer-active-name" class="font-bold text-xs text-slate-900 truncate cursor-pointer hover:text-pnt-purple transition-colors" title="Inspect Profile">Contact Name</h4>
                                <p id="drawer-active-role" class="text-[9px] text-slate-400 uppercase font-mono">Role</p>
                            </div>
                        </div>
                    </div>
                    <div id="drawer-messages-container" class="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50 flex flex-col justify-end"></div>
                    <form id="drawer-chat-form" class="p-3 border-t border-slate-200 bg-white flex items-center gap-2">
                        <input type="text" id="drawer-msg-input" placeholder="Type a message..." required class="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-pnt-purple">
                        <button type="submit" class="btn-brand-gradient text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm cursor-pointer">Send</button>
                    </form>
                </div>
            </div>
        </div>
    </div>

    <!-- POPUP MODAL: EXECUTIVE DOSSIER INSPECTOR -->
    <div id="user-profile-modal" class="fixed inset-0 bg-black/60 backdrop-blur-xs z-[90] hidden flex items-center justify-center p-4">
        <div class="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div class="p-5 border-b border-slate-100 flex justify-between items-center bg-purple-50/40">
                <div class="flex items-center gap-3">
                    <div id="inspect-avatar-container" class="w-12 h-12 rounded-full bg-pnt-purple text-white font-bold flex items-center justify-center text-sm overflow-hidden shrink-0 border-2 border-purple-200 shadow-sm">
                        --
                    </div>
                    <div>
                        <h3 id="inspect-fullname" class="text-sm font-black text-slate-900 leading-tight">Full Name</h3>
                        <div class="flex items-center gap-2 mt-0.5">
                            <span id="inspect-custom-id" class="text-[11px] font-mono text-pnt-purple font-bold">PNT-PENDING</span>
                            <span id="inspect-role-badge" class="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-purple-100 text-pnt-purple">Member</span>
                        </div>
                    </div>
                </div>
                <button type="button" onclick="closeModal('user-profile-modal')" class="text-slate-400 hover:text-slate-700 text-xl font-bold cursor-pointer">&times;</button>
            </div>

            <div class="p-6 overflow-y-auto space-y-5 text-xs text-slate-600 leading-relaxed">
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <h4 class="font-bold text-slate-900 uppercase tracking-wide text-[10px] text-pnt-purple">Contact & Assignment Telemetry</h4>
                    <div class="grid grid-cols-2 gap-2 text-xs">
                        <div><span class="text-slate-400 font-medium block">Email:</span> <span id="inspect-email" class="font-mono text-slate-800 font-semibold truncate block">--</span></div>
                        <div><span class="text-slate-400 font-medium block">Phone:</span> <span id="inspect-phone" class="font-mono text-slate-800 font-semibold block">--</span></div>
                        <div><span class="text-slate-400 font-medium block">Branch Office:</span> <span id="inspect-branch" class="text-slate-800 font-semibold block">--</span></div>
                        <div><span class="text-slate-400 font-medium block">State / Residence:</span> <span id="inspect-state" class="text-slate-800 font-semibold block">--</span></div>
                        <div><span class="text-slate-400 font-medium block">Sponsor ID:</span> <span id="inspect-sponsor" class="font-mono text-slate-800 font-semibold block">--</span></div>
                        <div><span class="text-slate-400 font-medium block">Account Status:</span> <span id="inspect-status" class="uppercase font-bold text-emerald-600 block">--</span></div>
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="bg-purple-50/50 p-4 rounded-xl border border-purple-100 space-y-1">
                        <span class="text-[10px] font-bold text-pnt-purple uppercase tracking-wider block">Original Sign-Up Date</span>
                        <span id="inspect-signup-date" class="text-xs font-mono font-extrabold text-slate-900">Loading...</span>
                    </div>

                    <div class="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 space-y-1">
                        <span class="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Attendance History (365-Day Span)</span>
                        <span id="inspect-attendance-ratio" class="text-xs font-mono font-extrabold text-slate-900">Calculating logs...</span>
                    </div>
                </div>

                <div class="space-y-2">
                    <h4 class="font-bold text-slate-900 uppercase tracking-wide text-[10px] text-pnt-purple">Full Transaction & Earnings Ledger</h4>
                    <div class="border border-slate-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                        <table class="w-full text-left text-[11px]">
                            <thead class="bg-slate-100 text-slate-500 font-bold uppercase text-[9px]">
                                <tr>
                                    <th class="py-2 px-3">Date</th>
                                    <th class="py-2 px-3">Type</th>
                                    <th class="py-2 px-3">Amount</th>
                                    <th class="py-2 px-3">Status</th>
                                </tr>
                            </thead>
                            <tbody id="inspect-ledger-tbody" class="divide-y divide-slate-100">
                                <tr>
                                    <td colspan="4" class="text-center py-3 text-slate-400">Querying financial records...</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button type="button" onclick="closeModal('user-profile-modal')" class="px-6 py-2.5 bg-pnt-purple text-white font-bold rounded-xl text-xs shadow-md cursor-pointer hover:opacity-90 transition-all">
                    Close Dossier
                </button>
            </div>
        </div>
    </div>

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
                <div id="attendance-counter-widget" class="p-4 rounded-xl bg-purple-50/60 border border-purple-200/60">
                    <h4 class="text-[11px] font-extrabold uppercase tracking-wider text-pnt-purple">ATTENDANCE HISTORY (365-DAY SPAN)</h4>
                    <p id="attendance-counter-text" class="text-xs font-mono font-bold text-slate-800 mt-1">Loading attendance record...</p>
                </div>

                <div>
                    <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Identity Details</h4>
                    <form id="pnt-profile-form" class="space-y-3.5">
                        <div class="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <div id="avatar-preview-container" class="w-14 h-14 rounded-full bg-purple-100 overflow-hidden shrink-0 border border-purple-200 flex items-center justify-center font-bold text-pnt-purple text-sm">
                                <span id="avatar-preview-initials">U</span>
                            </div>
                            <div class="flex-1">
                                <label class="block text-[11px] font-semibold text-slate-700 mb-1">Profile Photo / Avatar</label>
                                <input type="file" id="pnt-edit-avatar-file" accept="image/*" class="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-pnt-purple file:text-white hover:file:opacity-90 cursor-pointer">
                            </div>
                        </div>

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
                            <select id="pnt-edit-state" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-pnt-purple">
                                <option value="">Select State</option>
                                ${nigerianStates.map(st => `<option value="${st}">${st}</option>`).join('')}
                            </select>
                        </div>

                        <div>
                            <label class="block text-[11px] font-semibold text-slate-600 mb-1">Personal Bio</label>
                            <textarea id="pnt-edit-bio" rows="2" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-pnt-purple resize-none overflow-hidden" placeholder="Executive bio or role summary..."></textarea>
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

    <!-- CROPPER & ZOOM MODAL DIALOG -->
    <div id="pnt-cropper-modal" class="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-[70] hidden flex items-center justify-center p-4">
        <div class="bg-white border border-slate-200 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col p-5 space-y-4">
            <div class="text-center">
                <h3 class="text-sm font-bold text-slate-900">Crop & Zoom Profile Picture</h3>
                <p class="text-[11px] text-slate-500 mt-0.5">Drag to reposition and use slider to zoom</p>
            </div>
            
            <div id="cropper-viewport" class="w-64 h-64 mx-auto rounded-full overflow-hidden relative bg-slate-900 border-4 border-pnt-purple shadow-inner cursor-grab active:cursor-grabbing select-none">
                <canvas id="cropper-canvas" width="256" height="256" class="absolute inset-0 w-full h-full pointer-events-none"></canvas>
            </div>

            <div class="space-y-1 px-2">
                <div class="flex justify-between text-[10px] text-slate-500 font-semibold">
                    <span>Zoom Out</span>
                    <span>Zoom In</span>
                </div>
                <input type="range" id="cropper-zoom-range" min="0.5" max="3" step="0.05" value="1" class="w-full accent-pnt-purple cursor-pointer">
            </div>

            <div class="flex gap-2 pt-2">
                <button type="button" id="cropper-cancel-btn" class="w-1/2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer">Cancel</button>
                <button type="button" id="cropper-apply-btn" class="w-1/2 py-2 btn-brand-gradient text-white font-bold text-xs rounded-xl shadow-md cursor-pointer">Apply Crop</button>
            </div>
        </div>
    </div>
    `;

    // Global Branded Alert Utility Injection
    window.showPntAlert = function(message, title = 'ProNet-Tech Space') {
        const modal = document.getElementById('pnt-global-alert-modal');
        const titleEl = document.getElementById('pnt-global-alert-title');
        const msgEl = document.getElementById('pnt-global-alert-message');
        const btn = document.getElementById('pnt-global-alert-btn');

        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.textContent = message;
        if (modal) {
            modal.classList.remove('hidden');
            btn.onclick = () => {
                modal.classList.add('hidden');
            };
        }
    };

    window.alert = function(msg) {
        window.showPntAlert(msg);
    };

    window.openModal = function(id) {
        document.getElementById(id)?.classList.remove('hidden');
    };

    window.closeModal = function(id) {
        document.getElementById(id)?.classList.add('hidden');
    };

    // Global Executive Dossier Inspector Function
    window.inspectUserProfile = async function(userOrId) {
        let user = userOrId;
        if (typeof userOrId === 'string' || typeof userOrId === 'number') {
            try {
                const res = await fetch(`/api/auth/users/all`, { credentials: 'include' });
                const data = await res.json();
                if (data.success && data.data) {
                    user = data.data.find(u => u.id === userOrId);
                }
            } catch (e) {}
        }

        if (!user) return;

        document.getElementById('inspect-fullname').textContent = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User';
        document.getElementById('inspect-custom-id').textContent = user.custom_profile_id || user.customId || 'PNT-PENDING';
        document.getElementById('inspect-email').textContent = user.email || 'N/A';
        document.getElementById('inspect-phone').textContent = user.phone_number || 'N/A';
        document.getElementById('inspect-state').textContent = user.state ? `${user.state}, Nigeria` : 'Not Specified';
        document.getElementById('inspect-branch').textContent = user.office?.branch_name || user.office_name || 'Central Workspace Hub';
        document.getElementById('inspect-sponsor').textContent = user.sponsor_id || 'None';
        document.getElementById('inspect-status').textContent = user.status || 'active';

        const roleBadge = document.getElementById('inspect-role-badge');
        const isAdmin = user.role === 'admin' || user.role === 'global_admin';
        const isLeader = user.role === 'leader' || user.role === 'team_leader' || user.role === 'sub_admin';
        roleBadge.textContent = isAdmin ? 'Admin' : (isLeader ? 'Team Leader' : 'Member');

        const avatarContainer = document.getElementById('inspect-avatar-container');
        const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || 'U';
        if (user.avatar_url) {
            avatarContainer.innerHTML = `<img src="${user.avatar_url}" class="w-full h-full object-cover">`;
        } else {
            avatarContainer.innerHTML = `<span class="font-bold text-base">${initials}</span>`;
        }

        const signupDate = user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown';
        document.getElementById('inspect-signup-date').textContent = signupDate;

        document.getElementById('inspect-attendance-ratio').textContent = "Fetching telemetry...";
        document.getElementById('inspect-ledger-tbody').innerHTML = `<tr><td colspan="4" class="text-center py-3 text-slate-400">Loading ledger...</td></tr>`;

        window.openModal('user-profile-modal');

        try {
            const userId = user.id;
            const res = await fetch(`/api/auth/profile/telemetry/${userId}`, { credentials: 'include' });
            const data = await res.json();

            if (data.success) {
                const telemetry = data.telemetry;
                const attendanceCount = telemetry.attendanceCount || 0;
                document.getElementById('inspect-attendance-ratio').textContent = `${attendanceCount} days of active attendance out of 365`;

                const ledgerTbody = document.getElementById('inspect-ledger-tbody');
                ledgerTbody.innerHTML = '';

                if (!telemetry.transactions || telemetry.transactions.length === 0) {
                    ledgerTbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-slate-400">No transaction records found.</td></tr>`;
                } else {
                    telemetry.transactions.forEach(tx => {
                        const txDate = new Date(tx.created_at || tx.date).toLocaleDateString();
                        const isDeposit = tx.transaction_type === 'deposit';
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td class="py-2 px-3 font-mono text-slate-600">${txDate}</td>
                            <td class="py-2 px-3">
                                <span class="text-[9px] uppercase font-bold px-2.5 py-0.5 rounded-full border ${isDeposit ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}">
                                    ${isDeposit ? 'Deposit' : 'Withdrawal'}
                                </span>
                            </td>
                            <td class="py-2 px-3 font-mono font-bold ${isDeposit ? 'text-emerald-600' : 'text-rose-600'}">₦${Number(tx.amount || 0).toLocaleString()}</td>
                            <td class="py-2 px-3"><span class="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-emerald-50 text-emerald-700">${tx.status || 'Success'}</span></td>
                        `;
                        ledgerTbody.appendChild(tr);
                    });
                }
            } else {
                document.getElementById('inspect-attendance-ratio').textContent = "0 days of active attendance out of 365";
                document.getElementById('inspect-ledger-tbody').innerHTML = `<tr><td colspan="4" class="text-center py-3 text-slate-400">No transactions recorded.</td></tr>`;
            }
        } catch (err) {
            document.getElementById('inspect-attendance-ratio').textContent = "Telemetry unavailable";
            document.getElementById('inspect-ledger-tbody').innerHTML = `<tr><td colspan="4" class="text-center py-3 text-red-400">Failed to load financial ledger.</td></tr>`;
        }
    };

    async function executeRoutingGuard() {
        const currentPath = window.location.pathname;
        if (currentPath.includes('onboarding.html') || currentPath.includes('reset-password.html')) {
            return;
        }

        try {
            const res = await fetch('/api/auth/me', { credentials: 'include' });
            const data = await res.json();

            if (!data.success || !data.user) {
                if (!currentPath.includes('onboarding.html')) {
                    window.location.href = '/views/onboarding.html';
                }
                return;
            }

            const user = data.user;
            const isPendingPage = currentPath.includes('pending.html');
            const isAdminPage = currentPath.includes('admin.html');

            if (user.status === 'pending') {
                if (!isPendingPage) {
                    window.location.href = '/views/pending.html';
                }
            } else if (user.status === 'active') {
                if (isPendingPage) {
                    window.location.href = (user.role === 'admin' || user.role === 'global_admin') 
                        ? '/views/admin.html' 
                        : '/views/dashboard.html';
                }
            } else if (user.status === 'banned' || user.status === 'suspended') {
                alert(`Access Restricted: Your account has been ${user.status}. Reason: ${user.status_reason || 'Administrative policy violation.'}`);
                window.location.href = '/views/onboarding.html';
            }

            if (isAdminPage && user.role !== 'admin' && user.role !== 'global_admin' && user.role !== 'sub_admin') {
                window.location.href = '/views/dashboard.html';
            }
        } catch (err) {}
    }

    async function initSidebar() {
        await executeRoutingGuard();

        const existingRoot = document.getElementById('pnt-universal-nav-root');
        if (existingRoot) existingRoot.remove();

        const navWrapper = document.createElement('div');
        navWrapper.id = 'pnt-universal-nav-root';
        navWrapper.innerHTML = sidebarTemplate;
        document.body.prepend(navWrapper);

        document.body.classList.add('lg:pl-64');

        bindEvents();
        fetchSessionAndPopulate();
        loadAttendanceStats();
        startGlobalUnreadPoll();
        startModuleBadgesPoll();
    }

    function startGlobalUnreadPoll() {
        updateGlobalUnreadBadge();
        if (globalUnreadPollInterval) clearInterval(globalUnreadPollInterval);
        globalUnreadPollInterval = setInterval(updateGlobalUnreadBadge, 4000);
    }

    function startModuleBadgesPoll() {
        updateModuleBadges();
        if (moduleBadgesPollInterval) clearInterval(moduleBadgesPollInterval);
        moduleBadgesPollInterval = setInterval(updateModuleBadges, 6000);
    }

    async function updateModuleBadges() {
        try {
            const res = await fetch('/api/auth/badges/summary', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.badges) {
                    const attBadge = document.getElementById('sidebar-attendance-badge');
                    if (attBadge) {
                        if (data.badges.attendance > 0) {
                            attBadge.textContent = data.badges.attendance;
                            attBadge.classList.remove('hidden');
                        } else {
                            attBadge.classList.add('hidden');
                        }
                    }

                    const finBadge = document.getElementById('sidebar-finance-badge');
                    if (finBadge) {
                        if (data.badges.finance > 0) {
                            finBadge.textContent = data.badges.finance;
                            finBadge.classList.remove('hidden');
                        } else {
                            finBadge.classList.add('hidden');
                        }
                    }

                    const comBadge = document.getElementById('sidebar-community-badge');
                    if (comBadge) {
                        if (data.badges.community > 0) {
                            comBadge.textContent = data.badges.community;
                            comBadge.classList.remove('hidden');
                        } else {
                            comBadge.classList.add('hidden');
                        }
                    }

                    const annBadge = document.getElementById('sidebar-announcements-badge');
                    if (annBadge) {
                        if (data.badges.announcements > 0) {
                            annBadge.textContent = data.badges.announcements;
                            annBadge.classList.remove('hidden');
                        } else {
                            annBadge.classList.add('hidden');
                        }
                    }
                }
            }
        } catch (err) {}
    }

    async function updateGlobalUnreadBadge() {
        try {
            const res = await fetch('/api/chat/contacts', { credentials: 'include' });
            const data = await res.json();
            if (data.success && data.contacts) {
                const totalUnread = data.contacts.reduce((sum, c) => sum + (c.unread_count || 0), 0);
                
                const sidebarBadge = document.getElementById('sidebar-global-unread-badge');
                const mobileBadge = document.getElementById('mobile-global-unread-badge');

                if (sidebarBadge) {
                    if (totalUnread > 0) {
                        sidebarBadge.textContent = totalUnread;
                        sidebarBadge.classList.remove('hidden');
                    } else {
                        sidebarBadge.classList.add('hidden');
                    }
                }

                if (mobileBadge) {
                    if (totalUnread > 0) {
                        mobileBadge.textContent = totalUnread;
                        mobileBadge.classList.remove('hidden');
                    } else {
                        mobileBadge.classList.add('hidden');
                    }
                }
            }
        } catch (err) {}
    }

    function renderAvatar(containerEl, avatarUrl, initials) {
        if (!containerEl) return;
        if (avatarUrl) {
            containerEl.innerHTML = `<img src="${avatarUrl}" alt="Avatar" class="w-full h-full object-cover">`;
        } else {
            containerEl.innerHTML = `<span class="font-bold text-xs">${initials || 'U'}</span>`;
        }
    }

    function autoExpandBio(textarea) {
        if (!textarea) return;
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
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

        const bioInput = document.getElementById('pnt-edit-bio');
        bioInput?.addEventListener('input', function() {
            autoExpandBio(this);
        });

        const avatarFileEl = document.getElementById('pnt-edit-avatar-file');
        const cropperModal = document.getElementById('pnt-cropper-modal');
        const cropperCanvas = document.getElementById('cropper-canvas');
        const ctx = cropperCanvas.getContext('2d');
        const zoomRange = document.getElementById('cropper-zoom-range');
        const viewport = document.getElementById('cropper-viewport');

        function drawCropperImage() {
            if (!cropperImageObj) return;
            ctx.clearRect(0, 0, cropperCanvas.width, cropperCanvas.height);
            ctx.save();
            ctx.translate(cropperCanvas.width / 2 + cropperOffsetX, cropperCanvas.height / 2 + cropperOffsetY);
            ctx.scale(cropperScale, cropperScale);
            ctx.drawImage(cropperImageObj, -cropperImageObj.width / 2, -cropperImageObj.height / 2);
            ctx.restore();
        }

        avatarFileEl?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(event) {
                const img = new Image();
                img.onload = function() {
                    cropperImageObj = img;
                    cropperScale = 1;
                    cropperOffsetX = 0;
                    cropperOffsetY = 0;
                    zoomRange.value = 1;
                    drawCropperImage();
                    cropperModal.classList.remove('hidden');
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
            avatarFileEl.value = '';
        });

        zoomRange?.addEventListener('input', (e) => {
            cropperScale = parseFloat(e.target.value);
            drawCropperImage();
        });

        viewport?.addEventListener('mousedown', (e) => {
            isDragging = true;
            dragStartX = e.clientX - cropperOffsetX;
            dragStartY = e.clientY - cropperOffsetY;
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            cropperOffsetX = e.clientX - dragStartX;
            cropperOffsetY = e.clientY - dragStartY;
            drawCropperImage();
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
        });

        viewport?.addEventListener('touchstart', (e) => {
            isDragging = true;
            dragStartX = e.touches[0].clientX - cropperOffsetX;
            dragStartY = e.touches[0].clientY - cropperOffsetY;
        });

        window.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            cropperOffsetX = e.touches[0].clientX - dragStartX;
            cropperOffsetY = e.touches[0].clientY - dragStartY;
            drawCropperImage();
        });

        window.addEventListener('touchend', () => {
            isDragging = false;
        });

        document.getElementById('cropper-cancel-btn')?.addEventListener('click', () => {
            cropperModal.classList.add('hidden');
            cropperImageObj = null;
        });

        document.getElementById('cropper-apply-btn')?.addEventListener('click', () => {
            const finalDataUrl = cropperCanvas.toDataURL('image/jpeg', 0.9);
            const previewBox = document.getElementById('avatar-preview-container');
            previewBox.innerHTML = `<img src="${finalDataUrl}" class="w-full h-full object-cover">`;
            cropperModal.classList.add('hidden');
        });

        const chatDrawer = document.getElementById('pnt-chat-drawer');
        const chatCloseBtn = document.getElementById('pnt-chat-close-btn');
        const mobileChatToggle = document.getElementById('pnt-mobile-chat-toggle');

        const openChatDrawer = () => {
            closeSidebar();
            chatDrawer?.classList.remove('hidden');
            loadDrawerContacts();
            if (chatPollingInterval) clearInterval(chatPollingInterval);
            chatPollingInterval = setInterval(() => loadDrawerContacts(false), 4000);
        };

        const closeChatDrawer = () => {
            chatDrawer?.classList.add('hidden');
            if (chatPollingInterval) clearInterval(chatPollingInterval);
            updateGlobalUnreadBadge();
        };

        mobileChatToggle?.addEventListener('click', openChatDrawer);
        chatCloseBtn?.addEventListener('click', closeChatDrawer);
        chatDrawer?.addEventListener('click', (e) => {
            if (e.target === chatDrawer) closeChatDrawer();
        });

        document.getElementById('back-to-contacts-btn')?.addEventListener('click', () => {
            document.getElementById('chat-conversation-view').classList.add('hidden');
            document.getElementById('chat-contacts-view').classList.remove('hidden');
            activeRecipientId = null;
            loadDrawerContacts(true);
        });

        const settingsModal = document.getElementById('pnt-settings-modal');
        const openSettingsBtn = document.getElementById('btn-sidebar-open-settings');
        const closeSettingsBtn = document.getElementById('pnt-settings-close');

        const openModal = () => {
            closeSidebar();
            settingsModal?.classList.remove('hidden');
            setTimeout(() => autoExpandBio(document.getElementById('pnt-edit-bio')), 50);
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

        document.getElementById('drawer-chat-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('drawer-msg-input');
            const message = input.value.trim();
            if (!message || !activeRecipientId) return;

            input.value = '';
            try {
                const res = await fetch('/api/chat/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ recipient_id: activeRecipientId, message })
                });
                const data = await res.json();
                if (data.success) {
                    fetchDrawerMessages();
                }
            } catch (err) {
                alert('Failed to send message.');
            }
        });

        document.getElementById('drawer-contact-search')?.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase().trim();
            const filtered = contactsList.filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) || (c.custom_profile_id && c.custom_profile_id.toLowerCase().includes(q)));
            renderDrawerContacts(filtered);
        });

        document.getElementById('pnt-profile-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('pnt-save-profile-btn');
            btn.disabled = true;
            btn.textContent = 'Updating...';

            const payload = {
                first_name: document.getElementById('pnt-edit-fname').value.trim(),
                last_name: document.getElementById('pnt-edit-lname').value.trim(),
                phone_number: document.getElementById('pnt-edit-phone').value.trim(),
                state: document.getElementById('pnt-edit-state').value,
                bio: document.getElementById('pnt-edit-bio').value.trim()
            };

            const previewImg = document.querySelector('#avatar-preview-container img');
            if (previewImg && previewImg.src.startsWith('data:image')) {
                payload.avatar_url = previewImg.src;
            }

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
                alert('Connection error during submission.');
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

    async function loadAttendanceStats() {
        try {
            const res = await fetch('/api/attendance/my-stats', { credentials: 'include' });
            const data = await res.json();
            const counterText = document.getElementById('attendance-counter-text');
            if (counterText && data.success) {
                const count = data.count || 0;
                counterText.textContent = `${count} days of active attendance out of 365`;
            } else if (counterText) {
                counterText.textContent = `0 days of active attendance out of 365`;
            }
        } catch (err) {
            const counterText = document.getElementById('attendance-counter-text');
            if (counterText) counterText.textContent = `0 days of active attendance out of 365`;
        }
    }

    async function loadDrawerContacts(shouldRender = true) {
        try {
            const res = await fetch('/api/chat/contacts', { credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                contactsList = data.contacts || [];
                if (shouldRender) {
                    const searchQuery = document.getElementById('drawer-contact-search')?.value.toLowerCase().trim() || '';
                    const filtered = contactsList.filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchQuery) || (c.custom_profile_id && c.custom_profile_id.toLowerCase().includes(searchQuery)));
                    renderDrawerContacts(filtered);
                } else {
                    const searchQuery = document.getElementById('drawer-contact-search')?.value.toLowerCase().trim() || '';
                    const filtered = contactsList.filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchQuery) || (c.custom_profile_id && c.custom_profile_id.toLowerCase().includes(searchQuery)));
                    renderDrawerContacts(filtered);
                }
                updateGlobalUnreadBadge();
            }
        } catch (err) {
            const container = document.getElementById('drawer-contacts-list');
            if (container && container.children.length === 0) {
                container.innerHTML = `<div class="p-4 text-xs text-red-400 text-center">Failed to load contacts.</div>`;
            }
        }
    }

    function renderDrawerContacts(contacts) {
        const container = document.getElementById('drawer-contacts-list');
        if (!container) return;
        const scrollPos = container.scrollTop;
        container.innerHTML = '';

        if (contacts.length === 0) {
            container.innerHTML = `<div class="p-4 text-xs text-slate-400 text-center">No other contacts found.</div>`;
            return;
        }

        contacts.forEach(contact => {
            const initials = `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`.toUpperCase() || 'U';
            const roleBadge = contact.role ? contact.role.replace('_', ' ').toUpperCase() : 'MEMBER';
            const unreadCount = contact.unread_count || 0;
            
            const item = document.createElement('div');
            item.className = "p-3 flex items-center justify-between gap-3 cursor-pointer transition-all hover:bg-purple-50/50";
            
            item.innerHTML = `
                <div class="flex items-center gap-3 overflow-hidden flex-1">
                    <div class="w-10 h-10 rounded-full bg-purple-100 text-pnt-purple font-bold flex items-center justify-center text-xs shrink-0 overflow-hidden cursor-pointer hover:scale-105 transition-transform contact-avatar-trigger" title="Inspect Profile">
                        ${contact.avatar_url ? `<img src="${contact.avatar_url}" class="w-full h-full object-cover">` : initials}
                    </div>
                    <div class="overflow-hidden flex-1 contact-info-trigger" title="Inspect Profile">
                        <h4 class="font-bold text-xs text-slate-900 truncate hover:text-pnt-purple transition-colors">${contact.first_name} ${contact.last_name}</h4>
                        <p class="text-[9px] font-mono text-pnt-purple uppercase truncate">${roleBadge} • ${contact.custom_profile_id || 'PNT'}</p>
                    </div>
                </div>
                <div>
                    ${unreadCount > 0 ? `<span class="bg-red-500 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shrink-0 shadow-sm animate-pulse">${unreadCount}</span>` : ''}
                </div>
            `;

            item.querySelector('.flex-1').onclick = () => selectDrawerContact(contact);
            item.querySelector('.contact-avatar-trigger').onclick = (e) => {
                e.stopPropagation();
                window.inspectUserProfile(contact);
            };
            item.querySelector('.contact-info-trigger h4').onclick = (e) => {
                e.stopPropagation();
                window.inspectUserProfile(contact);
            };

            container.appendChild(item);
        });
        container.scrollTop = scrollPos;
    }

    async function selectDrawerContact(contact) {
        activeRecipientId = contact.id;
        
        contact.unread_count = 0;
        const searchQuery = document.getElementById('drawer-contact-search')?.value.toLowerCase().trim() || '';
        const filtered = contactsList.filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchQuery) || (c.custom_profile_id && c.custom_profile_id.toLowerCase().includes(searchQuery)));
        renderDrawerContacts(filtered);
        updateGlobalUnreadBadge();

        document.getElementById('drawer-active-name').textContent = `${contact.first_name} ${contact.last_name}`;
        document.getElementById('drawer-active-role').textContent = `${contact.role?.replace('_', ' ').toUpperCase()} • ${contact.custom_profile_id}`;
        
        const avatarBox = document.getElementById('drawer-active-avatar');
        const initials = `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`.toUpperCase() || 'U';
        avatarBox.innerHTML = contact.avatar_url ? `<img src="${contact.avatar_url}" class="w-full h-full object-cover rounded-full">` : initials;

        avatarBox.onclick = () => window.inspectUserProfile(contact);
        document.getElementById('drawer-active-name').onclick = () => window.inspectUserProfile(contact);

        document.getElementById('chat-contacts-view').classList.add('hidden');
        document.getElementById('chat-conversation-view').classList.remove('hidden');

        await fetchDrawerMessages();
        if (chatPollingInterval) clearInterval(chatPollingInterval);
        chatPollingInterval = setInterval(fetchDrawerMessages, 3000);
    }

    async function fetchDrawerMessages() {
        if (!activeRecipientId) return;
        try {
            const res = await fetch(`/api/chat/messages/${activeRecipientId}`, { credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                renderDrawerMessages(data.messages || []);
            }
        } catch (err) {}
    }

    function renderDrawerMessages(messages) {
        const container = document.getElementById('drawer-messages-container');
        if (!container || !activeUser) return;
        const isScrolledToBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;

        container.innerHTML = '';
        if (messages.length === 0) {
            container.innerHTML = `<div class="text-center text-xs text-slate-400 my-auto">No direct messages yet. Say hello!</div>`;
            return;
        }

        messages.forEach(msg => {
            const isMe = msg.sender_id === activeUser.id;
            const bubble = document.createElement('div');
            bubble.className = `max-w-[80%] p-3 rounded-2xl text-xs ${isMe ? 'bg-pnt-purple text-white self-end rounded-br-xs' : 'bg-slate-100 text-slate-800 self-start rounded-bl-xs'}`;
            bubble.innerHTML = `
                <p class="break-words">${msg.message}</p>
                <span class="text-[8px] opacity-70 block text-right mt-1 font-mono">${new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            `;
            container.appendChild(bubble);
        });

        if (isScrolledToBottom) {
            container.scrollTop = container.scrollHeight;
        }
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
            renderAvatar(document.getElementById('avatar-preview-container'), activeUser.avatar_url, initials);

            document.getElementById('pnt-edit-fname').value = activeUser.first_name || '';
            document.getElementById('pnt-edit-lname').value = activeUser.last_name || '';
            document.getElementById('pnt-edit-phone').value = activeUser.phone_number || '';
            document.getElementById('pnt-edit-state').value = activeUser.state || '';
            document.getElementById('pnt-edit-bio').value = activeUser.bio || '';
            autoExpandBio(document.getElementById('pnt-edit-bio'));

            const isAdmin = activeUser.role === 'admin' || activeUser.role === 'global_admin';
            const isLeader = activeUser.role === 'leader' || activeUser.role === 'team_leader' || activeUser.role === 'sub_admin';

            const roleFormatted = isAdmin ? 'GLOBAL ADMIN' : (activeUser.role === 'sub_admin' ? 'SUB-ADMIN' : (isLeader ? 'TEAM LEADER' : 'MEMBER'));
            document.getElementById('nav-role-badge').textContent = roleFormatted;
            const mobileRoleBadge = document.getElementById('mobile-nav-role-badge');
            if (mobileRoleBadge) mobileRoleBadge.textContent = roleFormatted;

            const targetHome = isAdmin ? '/views/admin.html' : (isLeader ? '/views/leader.html' : '/views/dashboard.html');
            const brandLogo = document.getElementById('nav-brand-logo');
            const mobileBrandLogo = document.getElementById('mobile-nav-brand-logo');
            if (brandLogo) brandLogo.href = targetHome;
            if (mobileBrandLogo) mobileBrandLogo.href = targetHome;

            renderRoleNavigation(activeUser);
        } catch (err) {}
    }

    function renderRoleNavigation(user) {
        const container = document.getElementById('sidebar-nav-links');
        if (!container) return;

        container.innerHTML = '';

        const links = [];
        const isAdmin = user.role === 'admin' || user.role === 'global_admin';
        const isLeader = user.role === 'leader' || user.role === 'team_leader' || user.role === 'sub_admin';

        if (isAdmin) {
            links.push({ label: 'Dashboard', href: '/views/admin.html', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>` });
            links.push({ label: 'Organization', href: '/views/team.html', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>` });
            links.push({ label: 'Offices Branch', href: '/views/offices.html', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>` });
            links.push({ label: 'Team Finance', href: '/views/finance.html', badgeId: 'sidebar-finance-badge', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>` });
            links.push({ label: 'Attendance', href: '/views/attendance.html', badgeId: 'sidebar-attendance-badge', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>` });
            links.push({ label: 'Community', href: '/views/community.html', badgeId: 'sidebar-community-badge', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 012 2h2v4l.586-.586z"/></svg>` });
            links.push({ label: 'Announcements', href: '/views/announcements.html', badgeId: 'sidebar-announcements-badge', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>` });
        } else if (isLeader) {
            links.push({ label: 'Dashboard', href: '/views/leader.html', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>` });
            links.push({ label: 'My Team', href: '/views/team.html', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>` });
            links.push({ label: 'Attendance', href: '/views/attendance.html', badgeId: 'sidebar-attendance-badge', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>` });
            links.push({ label: 'My Wallet', href: '/views/leader-finance.html', badgeId: 'sidebar-finance-badge', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>` });
            links.push({ label: 'Community', href: '/views/community.html', badgeId: 'sidebar-community-badge', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 012 2h2v4l.586-.586z"/></svg>` });
            links.push({ label: 'Announcements', href: '/views/announcements.html', badgeId: 'sidebar-announcements-badge', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>` });
        } else {
            links.push({ label: 'Dashboard', href: '/views/dashboard.html', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>` });
            links.push({ label: 'My Team', href: '/views/team.html', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>` });
            links.push({ label: 'My Wallet', href: '/views/member-finance.html', badgeId: 'sidebar-finance-badge', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>` });
            links.push({ label: 'Attendance', href: '/views/attendance.html', badgeId: 'sidebar-attendance-badge', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>` });
            links.push({ label: 'Community', href: '/views/community.html', badgeId: 'sidebar-community-badge', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 012 2h2v4l.586-.586z"/></svg>` });
            links.push({ label: 'Announcements', href: '/views/announcements.html', badgeId: 'sidebar-announcements-badge', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>` });
        }

        const currentPath = window.location.pathname;

        links.forEach(link => {
            const isCurrent = currentPath.endsWith(link.href.split('/').pop());

            const a = document.createElement('a');
            a.href = link.href;
            a.className = isCurrent
                ? "flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-pnt-purple bg-purple-50 rounded-xl border border-purple-200 shadow-2xs transition-all"
                : "flex items-center justify-between px-3.5 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all";
            
            a.innerHTML = `
                <div class="flex items-center gap-3 truncate">
                    <span class="${isCurrent ? 'text-pnt-purple' : 'text-slate-400'}">${link.icon}</span>
                    <span class="truncate">${link.label}</span>
                </div>
                ${link.badgeId ? `<span id="${link.badgeId}" class="hidden bg-red-500 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-xs animate-pulse">0</span>` : ''}
            `;

            container.appendChild(a);
        });

        // Messages Button at the Very Bottom of Sidebar Links
        const chatToggleBtn = document.createElement('button');
        chatToggleBtn.type = 'button';
        chatToggleBtn.className = "w-full text-left flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-pnt-purple bg-white border border-purple-200 rounded-xl shadow-2xs hover:bg-purple-50 transition-all cursor-pointer mt-2";
        chatToggleBtn.innerHTML = `
            <div class="flex items-center gap-3 truncate">
                <span class="text-pnt-purple">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                </span>
                <span class="truncate">Messages</span>
            </div>
            <span id="sidebar-global-unread-badge" class="hidden bg-red-500 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-xs animate-pulse">0</span>
        `;
        chatToggleBtn.addEventListener('click', () => {
            const drawer = document.getElementById('pnt-chat-drawer');
            drawer?.classList.remove('hidden');
            loadDrawerContacts();
            if (chatPollingInterval) clearInterval(chatPollingInterval);
            chatPollingInterval = setInterval(() => loadDrawerContacts(false), 4000);
        });
        container.appendChild(chatToggleBtn);

        updateGlobalUnreadBadge();
        updateModuleBadges();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSidebar);
    } else {
        initSidebar();
    }
})();