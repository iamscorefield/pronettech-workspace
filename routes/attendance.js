/**
 * Pronettech Workspace - Attendance & Verification Router
 * File: routes/attendance.js
 */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { protect, authorize } = require('../middleware/auth');

// ===================================================
// 1. MEMBER / LEADER ENDPOINT: MARK DAILY ATTENDANCE
// ===================================================
router.post('/checkin', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const officeId = req.user.office_id;

        if (!officeId) {
            return res.status(400).json({ success: false, message: 'You are not assigned to any physical office branch.' });
        }

        // Enforce November 1, 2026 Trial Launch & Expiration Gating
        const launchDate = new Date('2026-11-01T00:00:00Z');
        const trialExpiresAt = new Date(launchDate.getTime() + (30 * 24 * 60 * 60 * 1000)); // Dec 1, 2026
        const now = new Date();

        if (now > trialExpiresAt) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('has_paid_softcopy, membership_expires_at')
                .eq('id', userId)
                .single();

            const isAnnualPaid = profile?.membership_expires_at && new Date(profile.membership_expires_at) > now;
            const hasPaidSoftcopy = Boolean(profile?.has_paid_softcopy);

            if (!isAnnualPaid && !hasPaidSoftcopy) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Check-in Blocked: Your 1-month free trial has expired. Please activate your membership to resume attendance logging.' 
                });
            }
        }

        const today = new Date().toISOString().split('T')[0];
        
        const { data: existingLog } = await supabase
            .from('attendance_logs')
            .select('id')
            .eq('profile_id', userId)
            .gte('marked_time', `${today}T00:00:00Z`)
            .lte('marked_time', `${today}T23:59:59Z`);

        if (existingLog && existingLog.length > 0) {
            return res.status(400).json({ success: false, message: 'You have already submitted an attendance log for today.' });
        }

        const { data, error } = await supabase
            .from('attendance_logs')
            .insert([{
                profile_id: userId,
                office_id: officeId,
                status: 'pending',
                marked_time: new Date().toISOString()
            }])
            .select();

        if (error) throw error;

        return res.status(201).json({ 
            success: true, 
            message: 'Attendance logged successfully! Waiting for Team Leader verification.',
            log: data[0]
        });

    } catch (err) {
        console.error('Checkin error:', err.message);
        return res.status(500).json({ success: false, message: `Database error: ${err.message}` });
    }
});

// ===================================================
// 2. FETCH TODAY'S ATTENDANCE FOR OFFICE (EXCLUDING LEADER'S OWN LOG)
// ===================================================
router.get('/office/:officeId/today', protect, authorize('leader', 'admin', 'sub_admin', 'global_admin', 'team_leader'), async (req, res) => {
    const { officeId } = req.params;
    const currentUserId = req.user.id;

    try {
        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('attendance_logs')
            .select('*, profiles:profile_id(first_name, last_name, email, custom_profile_id, avatar_url)')
            .eq('office_id', officeId)
            .neq('profile_id', currentUserId) // Hides the leader's own check-in from their approval queue
            .gte('marked_time', `${today}T00:00:00Z`)
            .lte('marked_time', `${today}T23:59:59Z`)
            .order('marked_time', { ascending: false });

        if (error) {
            const { data: fallbackData, error: fbErr } = await supabase
                .from('attendance_logs')
                .select('*')
                .eq('office_id', officeId)
                .neq('profile_id', currentUserId)
                .order('marked_time', { ascending: false });

            if (fbErr) throw fbErr;
            return res.status(200).json({ success: true, attendance: fallbackData || [] });
        }

        const formattedAttendance = (data || []).map(item => ({
            ...item,
            clock_in: item.marked_time || item.created_at,
            profiles: item.profiles || {}
        }));

        return res.status(200).json({ success: true, attendance: formattedAttendance });
    } catch (err) {
        console.error('Error fetching office attendance:', err.message);
        return res.status(500).json({ success: false, message: `Failed to load branch attendance: ${err.message}` });
    }
});

// ===================================================
// 3. FETCH ALL ATTENDANCE (GLOBAL ADMIN / SUB-ADMIN VIEW)
// ===================================================
router.get('/all', protect, authorize('admin', 'sub_admin', 'global_admin'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('attendance_logs')
            .select('*, profiles:profile_id(first_name, last_name, email, custom_profile_id, avatar_url)')
            .order('marked_time', { ascending: false })
            .limit(100);

        if (error) throw error;

        const formattedAttendance = (data || []).map(item => ({
            ...item,
            clock_in: item.marked_time || item.created_at,
            profiles: item.profiles || {}
        }));

        return res.status(200).json({ success: true, attendance: formattedAttendance });
    } catch (err) {
        console.error('Error fetching all attendance:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to load global attendance records.' });
    }
});

// ===================================================
// 4. TEAM LEADER / ADMIN ENDPOINT: VERIFY/APPROVE ATTENDANCE
// ===================================================
router.put('/verify/:logId', protect, authorize('leader', 'admin', 'sub_admin', 'global_admin', 'team_leader'), async (req, res) => {
    const { logId } = req.params;
    const { status, notes } = req.body;

    if (!['confirmed', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid validation status parameter.' });
    }

    try {
        const { data, error } = await supabase
            .from('attendance_logs')
            .update({
                status,
                notes,
                verified_by: req.user.id,
                verified_at: new Date().toISOString()
            })
            .eq('id', logId)
            .select();

        if (error) throw error;

        return res.status(200).json({ 
            success: true, 
            message: `Attendance log successfully updated to ${status}.`,
            log: data[0]
        });

    } catch (err) {
        return res.status(500).json({ success: false, message: `Database update error: ${err.message}` });
    }
});

// ===================================================
// 5. MEMBER ENDPOINT: GET CURRENT WEEK'S LOGS
// ===================================================
router.get('/weekly', protect, async (req, res) => {
    try {
        const userId = req.user.id;

        const curr = new Date();
        const first = curr.getDate() - curr.getDay() + (curr.getDay() === 0 ? -6 : 1);
        
        const startOfWeek = new Date(curr.setDate(first));
        startOfWeek.setUTCHours(0,0,0,0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setUTCHours(23,59,59,999);

        const { data, error } = await supabase
            .from('attendance_logs')
            .select('status, marked_time')
            .eq('profile_id', userId)
            .gte('marked_time', startOfWeek.toISOString())
            .lte('marked_time', endOfWeek.toISOString());

        if (error) throw error;

        return res.status(200).json({ success: true, data: data || [] });
    } catch (err) {
        return res.status(500).json({ success: false, message: `Failed to fetch weekly logs: ${err.message}` });
    }
});

// ===================================================
// 6. LEADER/ADMIN ENDPOINT: GET REGIONAL METRICS & STATS
// ===================================================
router.get('/metrics/office/:officeId', protect, authorize('leader', 'admin', 'sub_admin', 'global_admin', 'team_leader'), async (req, res) => {
    const { officeId } = req.params;
    try {
        const { count: totalStaff, error: staffError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('office_id', officeId);

        if (staffError) throw staffError;

        const today = new Date().toISOString().split('T')[0];
        const { count: presentToday, error: presentError } = await supabase
            .from('attendance_logs')
            .select('*', { count: 'exact', head: true })
            .eq('office_id', officeId)
            .eq('status', 'confirmed')
            .gte('marked_time', `${today}T00:00:00Z`)
            .lte('marked_time', `${today}T23:59:59Z`);

        if (presentError) throw presentError;

        const { count: pendingCount, error: pendingError } = await supabase
            .from('attendance_logs')
            .select('*', { count: 'exact', head: true })
            .eq('office_id', officeId)
            .eq('status', 'pending');

        if (pendingError) console.warn('Pending attendance count note:', pendingError.message);

        return res.status(200).json({
            success: true,
            data: {
                totalStaff: totalStaff || 0,
                presentToday: presentToday || 0,
                pendingCount: pendingCount || 0
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: `Failed to load metrics: ${err.message}` });
    }
});

// ===================================================
// 7. FETCH PENDING ATTENDANCE LOGS FOR OFFICE
// ===================================================
router.get('/pending/office/:officeId', protect, authorize('leader', 'admin', 'sub_admin', 'global_admin', 'team_leader'), async (req, res) => {
    const { officeId } = req.params;
    const currentUserId = req.user.id;

    try {
        const { data, error } = await supabase
            .from('attendance_logs')
            .select('*, profiles:profile_id(first_name, last_name, email, custom_profile_id, avatar_url)')
            .eq('office_id', officeId)
            .eq('status', 'pending')
            .neq('profile_id', currentUserId)
            .order('marked_time', { ascending: false });

        if (error) throw error;

        const formattedLogs = (data || []).map(item => ({
            ...item,
            profiles: item.profiles || {}
        }));

        return res.status(200).json({ success: true, data: formattedLogs });
    } catch (err) {
        console.error('Error fetching pending attendance:', err.message);
        return res.status(500).json({ success: false, message: `Failed to load pending queue: ${err.message}` });
    }
});

module.exports = router;