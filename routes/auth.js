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
// 1. GET CURRENT USER PROFILE
// ===================================================
router.get('/me', protect, async (req, res) => {
    try {
        const userId = req.user.id;

        const { data: profile, error: profErr } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, role, status, custom_profile_id, office_id, avatar_url')
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

        return res.status(200).json({
            success: true,
            user: {
                id: profile.id,
                role: profile.role,
                status: profile.status,
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
// 2. AVATAR / PROFILE PHOTO UPLOAD
// ===================================================
router.put('/profile/avatar', protect, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image file uploaded.' });
        }

        const userId = req.user.id;
        const fileExt = req.file.originalname.split('.').pop();
        const filePath = `${userId}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: true
            });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        const avatarUrl = publicUrlData.publicUrl;

        const { error: profileError } = await supabase
            .from('profiles')
            .update({ avatar_url: avatarUrl })
            .eq('id', userId);

        if (profileError) throw profileError;

        return res.status(200).json({
            success: true,
            message: 'Profile photo updated successfully!',
            avatar_url: avatarUrl
        });
    } catch (err) {
        console.error('Avatar upload failed:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to upload profile picture.' });
    }
});

// ===================================================
// 3. STANDARD REGISTRATION / SIGNUP ROUTE
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
// 4. GOOGLE OAUTH INITIATION
// ===================================================
router.get('/google', async (req, res) => {
    try {
        const host = req.get('host');
        const protocol = req.protocol === 'https' || host.includes('vercel.app') || !host.includes('localhost') ? 'https' : 'http';
        const redirectUrl = `${protocol}://${host}/api/auth/google/callback`;

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl,
                skipBrowserRedirect: true
            }
        });

        if (error || !data?.url) {
            return res.status(400).json({ 
                success: false, 
                message: `Google OAuth initialization failed: ${error?.message || 'No redirect URL returned'}` 
            });
        }

        return res.redirect(data.url);
    } catch (err) {
        console.error('OAuth redirect error:', err.message);
        return res.status(500).json({ success: false, message: `OAuth initialization error: ${err.message}` });
    }
});

// ===================================================
// 5. GOOGLE OAUTH CALLBACK HANDLER
// ===================================================
router.get('/google/callback', async (req, res) => {
    try {
        const { code } = req.query;

        if (!code) {
            return res.redirect('/views/onboarding.html?error=no_auth_code');
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

        if (sessionError || !sessionData?.user) {
            console.error('Session exchange failed:', sessionError?.message);
            return res.redirect('/views/onboarding.html?error=auth_failed');
        }

        const user = sessionData.user;

        let { data: profile } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, role, status, custom_profile_id, office_id')
            .eq('id', user.id)
            .single();

        if (!profile) {
            const fullName = user.user_metadata?.full_name || user.user_metadata?.name || '';
            const nameParts = fullName.split(' ');
            const firstName = nameParts[0] || 'Member';
            const lastName = nameParts.slice(1).join(' ') || '';

            const { data: newProfile, error: profileErr } = await supabase
                .from('profiles')
                .insert([{
                    id: user.id,
                    email: user.email,
                    first_name: firstName,
                    last_name: lastName,
                    role: 'member',
                    status: 'active'
                }])
                .select()
                .single();

            if (profileErr) {
                console.error('Google profile creation error:', profileErr.message);
            }
            profile = newProfile;
        }

        const token = jwt.sign(
            { id: profile?.id || user.id, role: profile?.role || 'member', customId: profile?.custom_profile_id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000
        });

        if (profile?.role === 'admin' || profile?.role === 'global_admin') {
            return res.redirect('/views/admin.html');
        } else if (profile?.role === 'leader' || profile?.role === 'team_leader') {
            return res.redirect('/views/leader.html');
        } else {
            return res.redirect('/views/dashboard.html');
        }

    } catch (err) {
        console.error('OAuth Callback crash:', err.message);
        return res.redirect('/views/onboarding.html?error=server_error');
    }
});

// ===================================================
// 6. TRADITIONAL LOGIN VIA EMAIL/PASSWORD
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
            .select('id, first_name, last_name, role, status, custom_profile_id, office_id, avatar_url')
            .eq('id', data.user.id)
            .single();

        if (profErr || !profile) {
            return res.status(401).json({ success: false, message: 'System account profile mismatch.' });
        }

        if (profile.status === 'banned') {
            return res.status(403).json({ success: false, message: 'This account has been permanently suspended.' });
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
// 7. LEADER ENDPOINT: FETCH PENDING ACCOUNT REGISTRATIONS
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

// ===================================================
// 8. LEADER/ADMIN ENDPOINT: APPROVE PENDING ACCOUNT
// ===================================================
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

// ===================================================
// 9. LEADER/ADMIN ENDPOINT: REJECT PENDING ACCOUNT
// ===================================================
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
// 10. GLOBAL METRICS FOR ADMIN COMMAND CENTER
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
// 11. PUBLIC BADGE VERIFICATION ENDPOINT
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
// 12. ADMIN ENDPOINT: FETCH ALL USERS DIRECTORY TABLE
// ===================================================
router.get('/users/all', protect, authorize('admin'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, phone_number, custom_profile_id, role, status, created_at, avatar_url, office:offices(branch_name)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.status(200).json({ success: true, data });
    } catch (err) {
        console.error('Error fetching global users directory:', err.message);
        return res.status(500).json({ success: false, message: 'Could not fetch workspace user directory.' });
    }
});

// ===================================================
// 13. ADMIN ENDPOINT: TOGGLE USER ROLE
// ===================================================
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

module.exports = router;