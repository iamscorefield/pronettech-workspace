const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { protect, authorize } = require('../middleware/auth');

// ===================================================
// 1. GET CURRENT USER PROFILE (DIAGNOSTIC & FAIL-SAFE)
// ===================================================
router.get('/me', protect, async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch up-to-date profile details
        const { data: profile, error: profErr } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, role, status, custom_profile_id, office_id')
            .eq('id', userId)
            .single();

        if (profErr || !profile) {
            return res.status(404).json({ success: false, message: 'User profile not found.' });
        }

        // Fetch office name optionally using 'branch_name' instead of 'name'
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
                office_name: officeName
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ===================================================
// 2. STANDARD REGISTRATION / SIGNUP ROUTE
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
                role: 'employee',
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
// 3. GOOGLE OAUTH AUTHENTICATION REDIRECT
// ===================================================
router.get('/google', async (req, res) => {
    try {
        const { data, error } = await supabase.auth.getOAuthUrl({
            provider: 'google',
            options: {
                redirectTo: `http://localhost:5000/api/auth/google/callback`
            }
        });

        if (error || !data) {
            return res.status(400).json({ success: false, message: `Google Connection failed: ${error.message}` });
        }

        res.redirect(data.url);
    } catch (err) {
        return res.status(500).json({ success: false, message: `OAuth initialization error: ${err.message}` });
    }
});

// ===================================================
// 4. TRADITIONAL LOGIN VIA EMAIL/PASSWORD
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
            .select('id, first_name, last_name, role, status, custom_profile_id, office_id')
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
                office_name: officeName
            }
        });

    } catch (err) {
        return res.status(500).json({ success: false, message: `Server login failure: ${err.message}` });
    }
});

// ===================================================
// 5. LEADER ENDPOINT: FETCH PENDING ACCOUNT REGISTRATIONS
// ===================================================
router.get('/pending/office/:officeId', protect, authorize('leader', 'admin'), async (req, res) => {
    const { officeId } = req.params;
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, phone_number, custom_profile_id, created_at')
            .eq('office_id', officeId)
            .eq('status', 'pending')
            .eq('role', 'employee')
            .order('created_at', { ascending: true });

        if (error) throw error;
        res.status(200).json({ success: true, data });
    } catch (err) {
        console.error('Error loading pending user accounts:', err.message);
        res.status(500).json({ success: false, message: 'Could not fetch pending registrations.' });
    }
});

// ===================================================
// 6. LEADER/ADMIN ENDPOINT: APPROVE PENDING ACCOUNT
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
        res.status(200).json({ success: true, message: 'Employee registration approved successfully!', data: data[0] });
    } catch (err) {
        console.error('Account approval database error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to approve registration.' });
    }
});

// ===================================================
// 7. LEADER/ADMIN ENDPOINT: REJECT PENDING ACCOUNT
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
        res.status(200).json({ success: true, message: 'Employee registration rejected.', data: data[0] });
    } catch (err) {
        console.error('Account rejection database error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to reject registration.' });
    }
});

// ===================================================
// 8. GLOBAL METRICS FOR ADMIN COMMAND CENTER
// ===================================================
router.get('/metrics/global', protect, authorize('admin'), async (req, res) => {
    try {
        const { count: totalStaff, error: staffError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'employee');

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

module.exports = router;