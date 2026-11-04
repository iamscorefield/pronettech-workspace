/**
 * Pronettech Workspace - Authentication & User Management Router
 * File: routes/auth.js
 */

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

// Helper function for Official Launch Trial (November 1, 2026)
function calculateTrialStatus(profile) {
    const launchDate = new Date('2026-11-01T00:00:00Z'); // Official Launch Nov 1, 2026
    const trialExpiresAt = new Date(launchDate.getTime() + (30 * 24 * 60 * 60 * 1000)); // Dec 1, 2026
    const now = new Date();

    const diffTime = trialExpiresAt - now;
    let daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    let isExpired = false;

    if (daysRemaining > 0) {
        isExpired = false;
    } else {
        daysRemaining = 0;
        isExpired = true;
    }

    // If user has paid annual membership or softcopy, override expiration
    const isAnnualPaid = profile.membership_expires_at && new Date(profile.membership_expires_at) > now;
    const hasPaidSoftcopy = Boolean(profile.has_paid_softcopy);

    if (isAnnualPaid || hasPaidSoftcopy) {
        isExpired = false;
    }

    return {
        trialExpiresAt: trialExpiresAt.toISOString(),
        daysRemaining,
        isExpired
    };
}

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

        let { data: profile, error: profErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

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

        const trialInfo = calculateTrialStatus(profile);

        return res.status(200).json({
            success: true,
            user: {
                id: profile.id,
                role: profile.role || 'member',
                permissions: null,
                status: profile.status || 'active',
                status_reason: profile.status_reason || null,
                created_at: profile.created_at || new Date().toISOString(),
                membership_expires_at: trialInfo.trialExpiresAt,
                has_paid_softcopy: Boolean(profile.has_paid_softcopy),
                days_remaining: trialInfo.daysRemaining,
                is_expired: trialInfo.isExpired,
                first_name: profile.first_name || '',
                last_name: profile.last_name || '',
                name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
                email: profile.email,
                phone_number: profile.phone_number || '',
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
// 5. PASSWORD RESET & RECOVERY PIPELINE
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
// 6. SIGNUP ROUTE
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
        const cleanEmail = email.trim().toLowerCase();

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });

        if (authError || !authData.user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials provided.' });
        }

        const { data: profile, error: profErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', cleanEmail)
            .maybeSingle();

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

        const trialInfo = calculateTrialStatus(profile);

        const token = jwt.sign(
            { id: profile.id, role: profile.role || 'member', customId: profile.custom_profile_id },
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
                role: profile.role || 'member',
                permissions: null,
                status: profile.status || 'active', 
                status_reason: profile.status_reason || null, 
                created_at: profile.created_at || new Date().toISOString(),
                membership_expires_at: trialInfo.trialExpiresAt,
                has_paid_softcopy: Boolean(profile.has_paid_softcopy),
                days_remaining: trialInfo.daysRemaining,
                is_expired: trialInfo.isExpired,
                name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(), 
                email: profile.email, 
                phone_number: profile.phone_number || '', 
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
// 8. LEADER REGISTRATION CONTROLS & CONSENT PIPELINE
// ===================================================
router.get('/pending/office/:officeId', protect, authorize('leader', 'team_leader', 'sub_admin', 'admin', 'global_admin'), async (req, res) => {
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

router.post('/consent', protect, async (req, res) => {
    const { age_bracket, slide_acknowledgments, signed_name, signature_data } = req.body;

    if (!age_bracket || !signed_name || !signature_data) {
        return res.status(400).json({ success: false, message: 'Age bracket and legal signature details are required.' });
    }

    try {
        const { data, error } = await supabase
            .from('user_consents')
            .insert([{
                user_id: req.user.id,
                age_bracket,
                slide_acknowledgments: slide_acknowledgments || {},
                signed_name: signed_name.trim(),
                signature_data: signature_data.trim()
            }])
            .select()
            .single();

        if (error) throw error;

        return res.status(201).json({
            success: true,
            message: 'Consent agreement successfully recorded.',
            data
        });
    } catch (err) {
        console.error('Consent submission error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to record consent agreement.' });
    }
});

router.get('/consent/:userId', protect, authorize('admin', 'sub_admin', 'global_admin', 'leader', 'team_leader'), async (req, res) => {
    const { userId } = req.params;
    try {
        const { data, error } = await supabase
            .from('user_consents')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            return res.status(404).json({ success: false, message: 'No consent record found for this user.' });
        }
        return res.status(200).json({ success: true, data });
    } catch (err) {
        console.error('Fetch consent error:', err.message);
        return res.status(500).json({ success: false, message: 'Could not fetch user consent record.' });
    }
});

router.put('/approve/:profileId', protect, authorize('leader', 'team_leader', 'sub_admin', 'admin', 'global_admin'), async (req, res) => {
    const { profileId } = req.params;
    const { office_id, state } = req.body;

    try {
        const updatePayload = { status: 'active' };
        if (office_id) updatePayload.office_id = office_id;
        if (state) updatePayload.state = state.trim();

        const { data, error } = await supabase
            .from('profiles')
            .update(updatePayload)
            .eq('id', profileId)
            .select();

        if (error) throw error;
        res.status(200).json({ success: true, message: 'Member registration approved successfully!', data: data[0] });
    } catch (err) {
        console.error('Account approval database error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to approve registration.' });
    }
});

router.put('/reject/:profileId', protect, authorize('leader', 'team_leader', 'sub_admin', 'admin', 'global_admin'), async (req, res) => {
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
router.get('/metrics/global', protect, authorize('admin', 'sub_admin', 'global_admin'), async (req, res) => {
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
            .in('role', ['leader', 'team_leader', 'sub_admin']);

        if (leaderError) console.warn('Leader metrics note:', leaderError.message);

        let activeEscalations = 0;
        try {
            const { count: incidentCount } = await supabase
                .from('incidents')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'unresolved');
            if (incidentCount) activeEscalations = incidentCount;
        } catch (e) {}

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
router.get('/users/all', protect, authorize('admin', 'sub_admin', 'global_admin'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, phone_number, bio, state, sponsor_id, custom_profile_id, role, status, status_reason, membership_expires_at, has_paid_softcopy, created_at, avatar_url, office_id, office:offices(branch_name)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.status(200).json({ success: true, data });
    } catch (err) {
        console.error('Error fetching global users directory:', err.message);
        return res.status(500).json({ success: false, message: 'Could not fetch workspace user directory.' });
    }
});

router.get('/users/office/:officeId', protect, authorize('leader', 'team_leader', 'sub_admin', 'admin', 'global_admin'), async (req, res) => {
    try {
        const { officeId } = req.params;
        const { data, error } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, phone_number, state, sponsor_id, custom_profile_id, role, status, created_at, avatar_url, office_id')
            .eq('office_id', officeId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.status(200).json({ success: true, data: data || [] });
    } catch (err) {
        console.error('Error fetching office team:', err.message);
        return res.status(500).json({ success: false, message: 'Could not fetch office members.' });
    }
});

router.patch('/users/:id/role', protect, authorize('admin', 'global_admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { role, office_id } = req.body;

        if (!['member', 'leader', 'team_leader', 'sub_admin'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Invalid target role specification.' });
        }

        const updatePayload = { role };
        if (office_id) updatePayload.office_id = office_id;

        const { data, error } = await supabase
            .from('profiles')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return res.json({ 
            success: true, 
            message: `User role successfully updated to ${role.toUpperCase()}.`,
            data 
        });
    } catch (err) {
        console.error('Admin role update failed:', err);
        return res.status(500).json({ success: false, message: 'Failed to update user security role.' });
    }
});

router.patch('/users/:id/status', protect, async (req, res) => {
    try {
        const adminId = req.user.id;
        
        const { data: adminProfile, error: adminErr } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', adminId)
            .single();

        if (adminErr || !adminProfile || !['admin', 'global_admin', 'sub_admin'].includes(adminProfile.role)) {
            return res.status(403).json({ success: false, message: 'Unauthorized: Admin privileges required.' });
        }

        const { id } = req.params;
        const { status, reason } = req.body;

        let dbStatus = status?.toLowerCase();
        if (dbStatus === 'ban') dbStatus = 'banned';

        const validStatuses = ['active', 'pending', 'warning', 'inactive', 'suspended', 'banned'];
        if (!validStatuses.includes(dbStatus)) {
            dbStatus = 'suspended';
        }

        if (dbStatus !== 'active' && dbStatus !== 'pending' && (!reason || reason.trim() === '')) {
            return res.status(400).json({ success: false, message: 'A written justification or reason is required for disciplinary actions.' });
        }

        const { data, error } = await supabase
            .from('profiles')
            .update({ 
                status: dbStatus,
                status_reason: (dbStatus === 'active' || dbStatus === 'pending') ? null : reason.trim()
            })
            .eq('id', id)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(404).json({ success: false, message: 'User profile not found in database.' });
        }

        return res.json({
            success: true,
            message: `User status set to ${dbStatus.toUpperCase()} successfully.`,
            data: data[0]
        });
    } catch (err) {
        console.error('Admin status update failed:', err);
        return res.status(500).json({ success: false, message: `Failed: ${err.message}` });
    }
});

// ===================================================
// 11. FINANCIAL & ATTENDANCE DATA ENDPOINTS
// ===================================================
router.get('/ledger/all', protect, authorize('admin', 'sub_admin', 'global_admin'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ledger')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(200).json({ success: true, data: [] });
        }
        return res.status(200).json({ success: true, data: data || [] });
    } catch (err) {
        return res.status(200).json({ success: true, data: [] });
    }
});

router.get('/attendance/all', protect, authorize('admin', 'sub_admin', 'leader', 'team_leader', 'global_admin'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('attendance')
            .select('*, profiles:profile_id(first_name, last_name, email, custom_profile_id)')
            .order('marked_time', { ascending: false });

        if (error) {
            return res.status(200).json({ success: true, data: [] });
        }
        return res.status(200).json({ success: true, data: data || [] });
    } catch (err) {
        return res.status(200).json({ success: true, data: [] });
    }
});

// ===================================================
// 12. CORPORATE ANNOUNCEMENTS ENDPOINTS
// ===================================================
router.get('/announcements', protect, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(200).json({ success: true, data: [] });
        }
        return res.status(200).json({ success: true, data: data || [] });
    } catch (err) {
        return res.status(200).json({ success: true, data: [] });
    }
});

router.post('/announcements', protect, authorize('admin', 'sub_admin', 'global_admin'), async (req, res) => {
    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).json({ success: false, message: 'Title and content are required.' });
    }

    try {
        const { data, error } = await supabase
            .from('announcements')
            .insert([{
                title: title.trim(),
                content: content.trim(),
                author_id: req.user.id,
                is_global: true
            }])
            .select()
            .single();

        if (error) throw error;

        return res.status(201).json({
            success: true,
            message: 'Announcement broadcasted successfully!',
            data
        });
    } catch (err) {
        console.error('Announcement creation error:', err.message);
        return res.status(500).json({ success: false, message: `Failed to publish announcement: ${err.message}` });
    }
});

// ===================================================
// 13. USER PROFILE TELEMETRY ENDPOINT
// ===================================================
router.get('/profile/telemetry/:userId', protect, async (req, res) => {
    try {
        const { userId } = req.params;

        let attendanceCount = 0;
        const { count: attCount, error: attError } = await supabase
            .from('attendance_logs')
            .select('*', { count: 'exact', head: true })
            .eq('profile_id', userId)
            .eq('status', 'confirmed');

        if (!attError && attCount !== null) {
            attendanceCount = attCount;
        }

        let transactions = [];

        const { data: finData, error: finError } = await supabase
            .from('financial_transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (!finError && finData) {
            const taggedDeposits = finData.map(tx => ({
                ...tx,
                transaction_type: 'deposit',
                purpose: tx.category || tx.purpose || tx.description || 'Workspace Deposit'
            }));
            transactions = transactions.concat(taggedDeposits);
        }

        const { data: wdData, error: wdError } = await supabase
            .from('withdrawal_requests')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (!wdError && wdData) {
            const taggedWithdrawals = wdData.map(wd => ({
                ...wd,
                transaction_type: 'withdrawal',
                purpose: wd.purpose || 'Cash Payout Withdrawal'
            }));
            transactions = transactions.concat(taggedWithdrawals);
        }

        return res.status(200).json({
            success: true,
            telemetry: {
                attendanceCount,
                transactions
            }
        });
    } catch (err) {
        console.error('Error fetching profile telemetry:', err.message);
        return res.status(500).json({ success: false, message: 'Could not fetch telemetry records.' });
    }
});

// ===================================================
// 14. LIVE SIDEBAR BADGES SUMMARY ENDPOINT
// ===================================================
router.get('/badges/summary', protect, async (req, res) => {
    try {
        let attendancePending = 0;
        let financePending = 0;
        let communityUnread = 0;
        let announcementsUnread = 0;

        try {
            const { count, error } = await supabase
                .from('attendance_logs')
                .select('*', { count: 'exact', head: true })
                .neq('status', 'confirmed');
            
            if (!error && count !== null) {
                attendancePending = count;
            } else {
                const { count: pendingCount } = await supabase
                    .from('attendance_logs')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'pending');
                if (pendingCount) attendancePending = pendingCount;
            }
        } catch (e) {}

        try {
            const { count } = await supabase
                .from('withdrawal_requests')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');
            if (count) financePending = count;
        } catch (e) {
            try {
                const { count } = await supabase
                    .from('ledger')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'pending');
                if (count) financePending = count;
            } catch (err) {}
        }

        try {
            const { count } = await supabase
                .from('channel_messages')
                .select('*', { count: 'exact', head: true });
            if (count) communityUnread = count;
        } catch (e) {}

        try {
            const { count } = await supabase
                .from('announcements')
                .select('*', { count: 'exact', head: true });
            if (count) announcementsUnread = count;
        } catch (e) {}

        return res.json({
            success: true,
            badges: {
                attendance: attendancePending,
                finance: financePending,
                community: communityUnread,
                announcements: announcementsUnread
            }
        });
    } catch (err) {
        console.error('Badges summary fetch error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;