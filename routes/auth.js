const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const supabase = require('../config/supabase');
const { protect, authorize } = require('../middleware/auth');

// Multer in-memory storage for avatar uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// ===================================================
// 1. GET CURRENT USER PROFILE & TELEMETRY
// ===================================================
router.get('/me', protect, async (req, res) => {
    try {
        const userId = req.user.id;

        const { data: profile, error: profErr } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, role, status, status_reason, membership_expires_at, custom_profile_id, office_id, avatar_url')
            .eq('id', userId)
            .single();

        if (profErr || !profile) {
            return res.status(404).json({ success: false, message: 'User profile not found.' });
        }

        let officeName = null;
        if (profile.office_id) {
            const { data: officeData } = await supabase
                .from('offices')
                .select('branch_name')
                .eq('id', profile.office_id)
                .single();
            
            if (officeData) {
                officeName = officeData.branch_name;
            }
        }

        // Expiration & Remaining Days Calculation
        const now = new Date();
        const expiresAt = profile.membership_expires_at ? new Date(profile.membership_expires_at) : null;
        let daysRemaining = null;
        let isExpired = false;

        if (expiresAt) {
            const diffTime = expiresAt - now;
            daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (daysRemaining <= 0) {
                daysRemaining = 0;
                isExpired = true;
            }
        }

        return res.status(200).json({
            success: true,
            user: {
                id: profile.id,
                role: profile.role,
                status: profile.status,
                status_reason: profile.status_reason || null,
                membership_expires_at: profile.membership_expires_at,
                days_remaining: daysRemaining,
                is_expired: isExpired,
                name: `${profile.first_name} ${profile.last_name}`,
                customId: profile.custom_profile_id || 'PNT-2026-PENDING',
                office_id: profile.office_id || null,
                office_name: officeName,
                avatar_url: profile.avatar_url || null
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ===================================================
// 2. AVATAR UPLOAD (WITH AUTOMATIC OLD FILE CLEANUP)
// ===================================================
router.put('/profile/avatar', protect, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image file uploaded.' });
        }

        const userId = req.user.id;

        const { data: currentProfile } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', userId)
            .single();

        if (currentProfile && currentProfile.avatar_url) {
            try {
                const oldUrl = currentProfile.avatar_url;
                const oldFilePath = oldUrl.substring(oldUrl.lastIndexOf('/') + 1);
                if (oldFilePath) {
                    await supabase.storage.from('avatars').remove([oldFilePath]);
                }
            } catch (cleanupErr) {
                console.warn('Non-blocking: Failed to remove old avatar file:', cleanupErr.message);
            }
        }

        const fileExt = req.file.originalname.split('.').pop();
        const newFilePath = `${userId}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(newFilePath, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: true
            });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(newFilePath);

        const newAvatarUrl = publicUrlData.publicUrl;

        const { error: profileError } = await supabase
            .from('profiles')
            .update({ avatar_url: newAvatarUrl })
            .eq('id', userId);

        if (profileError) throw profileError;

        return res.status(200).json({
            success: true,
            message: 'Profile photo updated successfully and previous image purged!',
            avatar_url: newAvatarUrl
        });
    } catch (err) {
        console.error('Avatar upload failed:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to upload profile picture.' });
    }
});

// ===================================================
// 3. PASSWORD RESET PIPELINE
// ===================================================
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, message: 'Account email address is required.' });
    }

    try {
        const redirectUrl = `${req.protocol}://${req.get('host')}/views/reset-password.html`;

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: redirectUrl
        });

        if (error) throw error;

        return res.status(200).json({
            success: true,
            message: 'Password reset link has been dispatched to your email address.'
        });
    } catch (err) {
        console.error('Forgot password error:', err.message);
        return res.status(500).json({ 
            success: false, 
            message: err.message || 'Unable to process password reset request.' 
        });
    }
});

router.post('/reset-password', async (req, res) => {
    const { password, accessToken } = req.body;

    if (!password || password.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    try {
        if (accessToken) {
            const { error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: accessToken
            });
            if (sessionError) console.warn('Token handoff note:', sessionError.message);
        }

        const { error } = await supabase.auth.updateUser({ password });

        if (error) throw error;

        return res.status(200).json({
            success: true,
            message: 'Account password has been successfully reset.'
        });
    } catch (err) {
        console.error('Reset password application error:', err.message);
        return res.status(500).json({ 
            success: false, 
            message: err.message || 'Failed to update user password.' 
        });
    }
});

// ===================================================
// 4. SIGNUP ROUTE
// ===================================================
router.post('/signup', async (req, res) => {
    const { email, password, first_name, last_name, phone_number, office_id, sponsor_name, sponsor_number } = req.body;

    if (!email || !password || !first_name || !last_name || !phone_number || !office_id || !sponsor_name || !sponsor_number) {
        return res.status(400).json({ success: false, message: 'All registration parameters are strictly required.' });
    }

    try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password
        });

        if (authError || !authData.user) {
            return res.status(400).json({ success: false, message: authError?.message || 'Authentication sign-up failed.' });
        }

        const userId = authData.user.id;

        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .insert([{
                id: userId,
                first_name,
                last_name,
                email,
                phone_number,
                office_id,
                role: 'member',
                status: 'pending'
            }])
            .select();

        if (profileError) {
            return res.status(400).json({ success: false, message: `Profile allocation failure: ${profileError.message}` });
        }

        const userProfile = profileData && profileData[0];

        const { error: sponsorError } = await supabase
            .from('sponsors')
            .insert([{
                profile_id: userId,
                sponsor_name,
                sponsor_number
            }]);

        if (sponsorError) {
            return res.status(400).json({ success: false, message: `Sponsor logging failure: ${sponsorError.message}` });
        }

        return res.status(201).json({
            success: true,
            message: 'User registered successfully! Account is now pending confirmation from your Team Leader.',
            user: {
                custom_profile_id: userProfile?.custom_profile_id || 'PNT-2026-PENDING'
            }
        });

    } catch (err) {
        return res.status(500).json({ success: false, message: `Internal server failure: ${err.message}` });
    }
});

// ===================================================
// 5. LOGIN ROUTE
// ===================================================
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password inputs are required.' });
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error || !data.user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials provided.' });
        }

        const { data: profile, error: profErr } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, role, status, status_reason, membership_expires_at, custom_profile_id, office_id, avatar_url')
            .eq('id', data.user.id)
            .single();

        if (profErr || !profile) {
            return res.status(401).json({ success: false, message: 'System account profile mismatch.' });
        }

        if (profile.status === 'banned' || profile.status === 'ban') {
            return res.status(403).json({ 
                success: false, 
                message: `Account Banned: ${profile.status_reason || 'Suspended for administrative compliance violations.'}` 
            });
        }

        let officeName = null;
        if (profile.office_id) {
            const { data: officeData } = await supabase
                .from('offices')
                .select('branch_name')
                .eq('id', profile.office_id)
                .single();
            
            if (officeData) {
                officeName = officeData.branch_name;
            }
        }

        const token = jwt.sign(
            { id: profile.id, role: profile.role, customId: profile.custom_profile_id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000
        });

        return res.status(200).json({
            success: true,
            message: 'Authentication successful.',
            user: { 
                id: profile.id, 
                role: profile.role, 
                status: profile.status,
                status_reason: profile.status_reason || null,
                membership_expires_at: profile.membership_expires_at,
                name: `${profile.first_name} ${profile.last_name}`,
                customId: profile.custom_profile_id || 'PNT-2026-PENDING',
                office_id: profile.office_id || null,
                office_name: officeName,
                avatar_url: profile.avatar_url || null
            }
        });

    } catch (err) {
        return res.status(500).json({ success: false, message: `Server login failure: ${err.message}` });
    }
});

// ===================================================
// 6. LEADER ENDPOINTS (REGISTRATIONS)
// ===================================================
router.get('/pending/office/:officeId', protect, authorize('leader', 'admin'), async (req, res) => {
    const { officeId } = req.params;
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, phone_number, custom_profile_id, created_at, avatar_url')
            .eq('office_id', officeId)
            .eq('status', 'pending')
            .eq('role', 'member')
            .order('created_at', { ascending: true });

        if (error) throw error;
        res.status(200).json({ success: true, data });
    } catch (err) {
        console.error('Error loading pending user accounts:', err.message);
        res.status(500).json({ success: false, message: 'Could not fetch pending registrations.' });
    }
});

router.put('/approve/:profileId', protect, authorize('leader', 'admin'), async (req, res) => {
    const { profileId } = req.params;
    try {
        const { data, error } = await supabase
            .from('profiles')
            .update({ status: 'active' })
            .eq('id', profileId)
            .select();

        if (error) throw error;
        res.status(200).json({ success: true, message: 'Member registration approved successfully!', data: data[0] });
    } catch (err) {
        console.error('Account approval database error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to approve registration.' });
    }
});

router.put('/reject/:profileId', protect, authorize('leader', 'admin'), async (req, res) => {
    const { profileId } = req.params;
    try {
        const { data, error } = await supabase
            .from('profiles')
            .update({ status: 'rejected' })
            .eq('id', profileId)
            .select();

        if (error) throw error;
        res.status(200).json({ success: true, message: 'Member registration rejected.', data: data[0] });
    } catch (err) {
        console.error('Account rejection database error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to reject registration.' });
    }
});

// ===================================================
// 7. GLOBAL METRICS FOR ADMIN COMMAND CENTER
// ===================================================
router.get('/metrics/global', protect, authorize('admin'), async (req, res) => {
    try {
        const { count: totalStaff, error: staffError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'member');

        if (staffError) throw staffError;

        const { count: totalBranches, error: branchError } = await supabase
            .from('offices')
            .select('*', { count: 'exact', head: true });

        if (branchError) throw branchError;

        const { count: totalLeaders, error: leaderError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'leader');

        if (leaderError) throw leaderError;

        const { count: activeEscalations, error: incidentError } = await supabase
            .from('incidents')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'unresolved');

        if (incidentError) throw incidentError;

        res.status(200).json({
            success: true,
            data: {
                totalStaff: totalStaff || 0,
                totalBranches: totalBranches || 0,
                totalLeaders: totalLeaders || 0,
                activeEscalations: activeEscalations || 0
            }
        });
    } catch (err) {
        console.error('Error fetching global admin metrics:', err.message);
        res.status(500).json({ success: false, message: 'Could not load global telemetry.' });
    }
});

// ===================================================
// 8. PUBLIC BADGE VERIFICATION ENDPOINT
// ===================================================
router.get('/verify-public/:customId', async (req, res) => {
    try {
        const { customId } = req.params;
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, custom_profile_id, role, status, created_at, avatar_url, office:offices(branch_name)')
            .eq('custom_profile_id', customId.trim().toUpperCase())
            .single();

        if (error || !profile) {
            return res.status(404).json({ success: false, message: 'Member credential not found in workspace database.' });
        }

        const roleFormatted = (profile.role === 'leader' || profile.role === 'team_leader') 
            ? 'Team Leader' 
            : (profile.role === 'admin' ? 'Global Admin' : 'Member');

        return res.json({
            success: true,
            data: {
                name: `${profile.first_name} ${profile.last_name}`,
                customId: profile.custom_profile_id,
                rank: roleFormatted,
                status: profile.status || 'Active',
                office: profile.office?.branch_name || 'Physical Branch',
                avatar_url: profile.avatar_url || null
            }
        });
    } catch (err) {
        console.error('Public verification error:', err);
        return res.status(500).json({ success: false, message: 'Server database verification error.' });
    }
});

// ===================================================
// 9. ADMIN ENDPOINTS (DIRECTORY, ROLES & DISCIPLINARY ACTIONS)
// ===================================================

// A. Fetch All Users Directory Table (with Avatar, Role, Status & Reason)
router.get('/users/all', protect, authorize('admin'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, phone_number, custom_profile_id, role, status, status_reason, membership_expires_at, created_at, avatar_url, office:offices(branch_name)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.status(200).json({ success: true, data });
    } catch (err) {
        console.error('Error fetching global users directory:', err.message);
        return res.status(500).json({ success: false, message: 'Could not fetch workspace user directory.' });
    }
});

// B. Toggle Role (Member / Leader)
router.patch('/users/:id/role', protect, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!['member', 'leader'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Invalid target role specification.' });
        }

        const { data, error } = await supabase
            .from('profiles')
            .update({ role })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return res.json({ 
            success: true, 
            message: `User role successfully updated to ${role === 'leader' ? 'Team Leader' : 'Member'}.`,
            data 
        });
    } catch (err) {
        console.error('Admin role update failed:', err);
        return res.status(500).json({ success: false, message: 'Failed to update user security role.' });
    }
});

// C. Apply Disciplinary Action (Warning, Inactive, Suspended, Ban, Active) with Stored Reason
router.patch('/users/:id/status', protect, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;

        const validStatuses = ['active', 'warning', 'inactive', 'suspended', 'ban', 'banned'];
        if (!validStatuses.includes(status?.toLowerCase())) {
            return res.status(400).json({ success: false, message: 'Invalid status provided.' });
        }

        if (status !== 'active' && (!reason || reason.trim() === '')) {
            return res.status(400).json({ success: false, message: 'A written justification or reason is required for disciplinary actions.' });
        }

        const normalizedStatus = status === 'ban' ? 'banned' : status.toLowerCase();

        const { data, error } = await supabase
            .from('profiles')
            .update({ 
                status: normalizedStatus,
                status_reason: status === 'active' ? null : reason.trim()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return res.json({
            success: true,
            message: `User status set to ${normalizedStatus.toUpperCase()} successfully.`,
            data
        });
    } catch (err) {
        console.error('Admin status update failed:', err);
        return res.status(500).json({ success: false, message: 'Failed to apply disciplinary action.' });
    }
});

module.exports = router;