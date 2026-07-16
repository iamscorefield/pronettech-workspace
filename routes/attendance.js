const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { protect, authorize } = require('../middleware/auth');

// ===================================================
// 1. EMPLOYEE ENDPOINT: MARK DAILY ATTENDANCE
// ===================================================
router.post('/checkin', protect, authorize('employee'), async (req, res) => {
    try {
        const userId = req.user.id;
        const officeId = req.user.office_id;

        if (!officeId) {
            return res.status(400).json({ success: false, message: 'You are not assigned to any physical office branch.' });
        }

        // Check if user already marked attendance today to prevent double logging
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

        // Insert new pending attendance row into Supabase
        const { data, error } = await supabase
            .from('attendance_logs')
            .insert([{
                profile_id: userId,
                office_id: officeId,
                status: 'pending'
            }])
            .select();

        if (error) throw error;

        return res.status(201).json({ 
            success: true, 
            message: 'Attendance request logged successfully! Waiting for Team Leader verification.',
            log: data[0]
        });

    } catch (err) {
        return res.status(500).json({ success: false, message: `Database error: ${err.message}` });
    }
});

// ===================================================
// 2. TEAM LEADER ENDPOINT: VERIFY/APPROVE ATTENDANCE
// ===================================================
router.put('/verify/:logId', protect, authorize('leader', 'admin'), async (req, res) => {
    const { logId } = req.params;
    const { status, notes } = req.body; // status must be 'confirmed' or 'rejected'

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
// 3. EMPLOYEE ENDPOINT: GET CURRENT WEEK'S LOGS
// ===================================================
router.get('/weekly', protect, authorize('employee'), async (req, res) => {
    try {
        const userId = req.user.id;

        // Calculate the boundaries of the current week (Monday to Sunday)
        const curr = new Date();
        const first = curr.getDate() - curr.getDay() + (curr.getDay() === 0 ? -6 : 1); // Adjust Monday position
        
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

        return res.status(200).json({ success: true, data });
    } catch (err) {
        return res.status(500).json({ success: false, message: `Failed to fetch weekly logs: ${err.message}` });
    }
});

// ===================================================
// 4. LEADER ENDPOINT: GET REGIONAL METRICS & STATS
// ===================================================
router.get('/metrics/office/:officeId', protect, authorize('leader', 'admin'), async (req, res) => {
    const { officeId } = req.params;
    try {
        // Query 1: Total staff assigned to this office branch
        const { count: totalStaff, error: staffError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('office_id', officeId)
            .eq('role', 'employee');

        if (staffError) throw staffError;

        // Query 2: Total employees present/confirmed today
        const today = new Date().toISOString().split('T')[0];
        const { count: presentToday, error: presentError } = await supabase
            .from('attendance_logs')
            .select('*', { count: 'exact', head: true })
            .eq('office_id', officeId)
            .eq('status', 'confirmed')
            .gte('marked_time', `${today}T00:00:00Z`)
            .lte('marked_time', `${today}T23:59:59Z`);

        if (presentError) throw presentError;

        // Query 3: Total pending reviews today
        const { count: pendingCount, error: pendingError } = await supabase
            .from('attendance_logs')
            .select('*', { count: 'exact', head: true })
            .eq('office_id', officeId)
            .eq('status', 'pending');

        if (pendingError) throw pendingError;

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
// 5. LEADER ENDPOINT: GET PENDING REGIONAL QUEUE
// ===================================================
router.get('/pending/office/:officeId', protect, authorize('leader', 'admin'), async (req, res) => {
    const { officeId } = req.params;
    try {
        const { data, error } = await supabase
            .from('attendance_logs')
            .select('*, profiles!attendance_logs_profile_id_fkey(first_name, last_name, custom_profile_id)')
            .eq('office_id', officeId)
            .eq('status', 'pending')
            .order('marked_time', { ascending: true });

        if (error) throw error;

        return res.status(200).json({ success: true, data });
    } catch (err) {
        return res.status(500).json({ success: false, message: `Failed to load pending queue: ${err.message}` });
    }
});

module.exports = router;