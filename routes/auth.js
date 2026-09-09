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
// 1. LIVE SPONSOR VALIDATION ENDPOINT (STRICT GATEWAY)
// ===================================================
router.get('/verify-sponsor/:customId', async (req, res) => {
    try {
        const { customId } = req.params;

        if (!customId || customId.trim() === '') {
            return res.status(400).json({ success: false, message: 'Sponsor Workspace ID is required.' });
        }

        const formattedId = customId.trim().toUpperCase();

        const { data: sponsor, error } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, custom_profile_id, status, role')
            .eq('custom_profile_id', formattedId)
            .single();

        if (error || !sponsor) {
            return res.status(404).json({
                success: false,
                message: 'Invalid Sponsor ID. No active workspace account found with this ID.'
            });
        }

        if (sponsor.status === 'banned' || sponsor.status === 'ban') {
            return res.status(403).json({
                success: false,
                message: 'This Sponsor account is suspended and cannot accept new members.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Sponsor verified successfully.',
            sponsor: {
                id: sponsor.id,
                name: `${sponsor.first_name} ${sponsor.last_name}`,
                customId: sponsor.custom_profile_id,
                role: sponsor.role
            }
        });
    } catch (err) {
        console.error('Sponsor validation error:', err);
        return res.status(500).json({ success: false, message: 'Server error verifying sponsor ID.' });
    }
});

// ===================================================
// 2. GET CURRENT USER PROFILE & TELEMETRY
// ===================================================
router.get('/me', protect, async (req, res) => {
    try {
        const userId = req.user.id;

        const { data: profile, error: profErr } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, phone_number, bio, state, sponsor_id, role, status, status_reason, membership_expires_at, has_paid_softcopy, custom_profile_id, office_id, avatar_url')
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

        const now = new Date();
        const expiresAt = profile.membership_expires_at ? new Date(profile.membership_expires_at) : null;
        let daysRemaining = null;
        let isExpired = true;

        if (expiresAt && !isNaN(expiresAt.getTime())) {
            const diffTime = expiresAt - now;
            daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (daysRemaining > 0) {
                isExpired = false;
            } else {
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
                membership_expires_at: profile.membership_expires_at || null,
                has_paid_softcopy: Boolean(profile.has_paid_softcopy),
                days_remaining: daysRemaining,
                is_expired: isExpired,
                first_name: profile.first_name,
                last_name: profile.last_name,
                name: `${profile.first_name} ${profile.last_name}`,
                email: profile.email,
                phone_number: profile.phone_number,
                bio: profile.bio || '',
                state: profile.state || '',
                sponsor_id: profile.sponsor_id || null,
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
// 3. PROFILE UPDATE & PASSWORD UPDATE
// ===================================================
router.put('/profile/update', protect, async (req, res) => {
    const { first_name, last_name, phone_number, bio, state } = req.body;

    try {
        const updatePayload = {};
        if (first_name) updatePayload.first_name = first_name.trim();
        if (last_name) updatePayload.last_name = last_name.trim();
        if (phone_number) updatePayload.phone_number = phone_number.trim();
        if (bio !== undefined) updatePayload.bio = bio.trim();
        if (state) updatePayload.state = state.trim();

        const { data, error } = await supabase
            .from('profiles')
            .update(updatePayload)
            .eq('id', req.user.id)
            .select()
            .single();

        if (error) throw error;

        return res.status(200).json({
            success: true,
            message: 'Profile details updated successfully.',
            user: data
        });
    } catch (err) {
        console.error('Profile update failed:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.put('/profile/password', protect, async (req, res) => {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
        return res.status(400).json({ success: false, message: 'Both current and new passwords are required.' });
    }

    if (new_password.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
    }

    try {
        const { data: userRecord, error: userErr } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', req.user.id)
            .single();

        if (userErr || !userRecord?.email) {
            return res.status(404).json({ success: false, message: 'User verification failed.' });
        }

        const { error: signInErr } = await supabase.auth.signInWithPassword({
            email: userRecord.email,
            password: current_password
        });

        if (signInErr) {
            return res.status(400).json({ success: false, message: 'Incorrect current password.' });
        }

        const { error: updateErr } = await supabase.auth.admin.updateUserById(req.user.id, {
            password: new_password
        });

        if (updateErr) throw updateErr;

        return res.status(200).json({
            success: true,
            message: 'Password changed successfully!'
        });
    } catch (err) {
        console.error('Password change error:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to update password.' });
    }
});

// ===================================================
// 4. AVATAR UPLOAD (WITH AUTOMATIC OLD FILE CLEANUP)
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
            message: 'Profile photo updated successfully!',
            avatar_url: newAvatarUrl
        });
    } catch (err) {
        console.error('Avatar upload failed:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to upload profile picture.' });
    }
});

// ===================================================
// 5. PASSWORD RESET PIPELINE
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
// 6. SIGNUP ROUTE (ZERO MOCK MEMBERSHIP DURATION)
// ===================================================
router.post('/signup', async (req, res) => {
    const { email, password, first_name, last_name, phone_number, state, office_id, sponsor_id } = req.body;

    if (!email || !password || !first_name || !last_name || !phone_number || !state || !office_id) {
        return res.status(400).json({ success: false, message: 'All personal, regional, and branch office fields are mandatory.' });
    }

    if (!sponsor_id || sponsor_id.trim() === '') {
        return res.status(400).json({ 
            success: false, 
            message: 'A valid Sponsor Workspace ID is strictly required to register.' 
        });
    }

    const cleanSponsorId = sponsor_id.trim().toUpperCase();

    try {
        const { data: sponsorRecord, error: sponsorErr } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, custom_profile_id, status')
            .eq('custom_profile_id', cleanSponsorId)
            .single();

        if (sponsorErr || !sponsorRecord) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid Sponsor ID. You must provide a valid Sponsor Workspace ID from an existing member or leader.' 
            });
        }

        if (sponsorRecord.status === 'banned' || sponsorRecord.status === 'ban') {
            return res.status(403).json({ 
                success: false, 
                message: 'Registration blocked: The specified Sponsor account is currently suspended.' 
            });
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password
        });

        if (authError || !authData.user) {
            return res.status(400).json({ success: false, message: authError?.message || 'Authentication sign-up failed.' });
        }

        const userId = authData.user.id;

        // Strict Zero-Mock: membership_expires_at is null, has_paid_softcopy is false
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .insert([{
                id: userId,
                first_name: first_name.trim(),
                last_name: last_name.trim(),
                email: email.trim().toLowerCase(),
                phone_number: phone_number.trim(),
                state: state.trim(),
                sponsor_id: cleanSponsorId,
                office_id,
                role: 'member',
                status: 'pending',
                membership_expires_at: null,
                has_paid_softcopy: false
            }])
            .select();

        if (profileError) {
            return res.status(400).json({ success: false, message: `Profile allocation failure: ${profileError.message}` });
        }

        const userProfile = profileData && profileData[0];

        await supabase
            .from('sponsors')
            .insert([{
                profile_id: userId,
                sponsor_name: `${sponsorRecord.first_name} ${sponsorRecord.last_name}`,
                sponsor_number: cleanSponsorId
            }]);

        return res.status(201).json({
            success: true,
            message: 'Registration successful! Account pending confirmation from your Team Leader.',
            user: {
                custom_profile_id: userProfile?.custom_profile_id || 'PNT-2026-PENDING'
            }
        });

    } catch (err) {
        return res.status(500).json({ success: false, message: `Internal server failure: ${err.message}` });
    }
});

// ===================================================
// 7. LOGIN ROUTE
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
            .select('id, first_name, last_name, email, phone_number, bio, state, sponsor_id, role, status, status_reason, membership_expires_at, has_paid_softcopy, custom_profile_id, office_id, avatar_url')
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
                membership_expires_at: profile.membership_expires_at || null,
                has_paid_softcopy: Boolean(profile.has_paid_softcopy),
                name: `${profile.first_name} ${profile.last_name}`, 
                email: profile.email, 
                phone_number: profile.phone_number, 
                bio: profile.bio || '', 
                state: profile.state || '', 
                sponsor_id: profile.sponsor_id || null, 
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
// 8. LEADER REGISTRATION CONTROLS
// ===================================================
router.get('/pending/office/:officeId', protect, authorize('leader', 'admin'), async (req, res) => {
    const { officeId } = req.params;
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, phone_number, state, sponsor_id, custom_profile_id, created_at, avatar_url')
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
// 9. GLOBAL METRICS FOR ADMIN COMMAND CENTER
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
// 10. ADMIN DIRECTORY & DISCIPLINARY ACTIONS
// ===================================================
router.get('/users/all', protect, authorize('admin'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, phone_number, bio, state, sponsor_id, custom_profile_id, role, status, status_reason, membership_expires_at, has_paid_softcopy, created_at, avatar_url, office:offices(branch_name)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.status(200).json({ success: true, data });
    } catch (err) {
        console.error('Error fetching global users directory:', err.message);
        return res.status(500).json({ success: false, message: 'Could not fetch workspace user directory.' });
    }
});

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