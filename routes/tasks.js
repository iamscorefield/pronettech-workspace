/**
 * Pronettech Workspace - Task Management Router
 * File: routes/tasks.js
 */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { protect, authorize } = require('../middleware/auth');

// 1. GET: Fetch tasks assigned to a specific user ID (Member or Leader View)
router.get('/user/:userId', protect, async (req, res) => {
    const { userId } = req.params;
    try {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('assigned_to', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.status(200).json({ success: true, data });
    } catch (err) {
        console.error('Error loading user tasks:', err.message);
        res.status(500).json({ success: false, message: 'Could not fetch user tasks.' });
    }
});

// 2. GET: Fetch tasks for a specific regional office (Leader Monitor View)
router.get('/office/:officeId', protect, authorize('leader', 'admin', 'sub_admin', 'global_admin'), async (req, res) => {
    const { officeId } = req.params;
    try {
        const { data, error } = await supabase
            .from('tasks')
            .select('*, profiles!tasks_assigned_to_fkey!inner(first_name, last_name, custom_profile_id, office_id)')
            .eq('profiles.office_id', officeId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.status(200).json({ success: true, data });
    } catch (err) {
        console.error('Error loading office tasks:', err.message);
        res.status(500).json({ success: false, message: 'Could not fetch office tasks.' });
    }
});

// 3. GET: Fetch all completed tasks globally (Admin Queue Review)
router.get('/global/completed', protect, authorize('admin', 'sub_admin', 'global_admin'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tasks')
            .select('*, profiles!tasks_assigned_to_fkey(first_name, last_name, custom_profile_id)')
            .eq('status', 'completed')
            .order('updated_at', { ascending: false });

        if (error) throw error;
        res.status(200).json({ success: true, data });
    } catch (err) {
        console.error('Error loading global completed tasks:', err.message);
        res.status(500).json({ success: false, message: 'Could not fetch task queues.' });
    }
});

// 4. GET: Fetch active leaders for task assignment dropdown (Foolproof Query)
router.get('/leaders/list', protect, authorize('admin', 'sub_admin', 'global_admin'), async (req, res) => {
    try {
        // Fetch all profiles to ensure we don't miss anyone due to strict role matching variations
        const { data, error } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, custom_profile_id, role, status')
            .order('first_name', { ascending: true });

        if (error) throw error;

        // Filter intelligently: include anyone who is a leader, sub_admin, team_leader, or even admins if needed, 
        // while excluding banned profiles. If role matching is loose, this guarantees they appear.
        const leadersList = (data || []).filter(u => {
            const role = (u.role || '').toLowerCase();
            const status = (u.status || 'active').toLowerCase();
            const isNotBanned = status !== 'banned' && status !== 'ban' && status !== 'suspended';
            const isLeaderRole = role.includes('leader') || role.includes('sub_admin') || role === 'admin' || role === 'global_admin';
            return isNotBanned && isLeaderRole;
        });

        res.status(200).json({ success: true, data: leadersList });
    } catch (err) {
        console.error('Error fetching leaders list:', err.message);
        res.status(500).json({ success: false, message: 'Failed to load leaders list.' });
    }
});

// 5. POST: Deploy a new task
router.post('/', protect, authorize('leader', 'admin', 'sub_admin', 'global_admin'), async (req, res) => {
    const { title, assigneeCustomId, assigneeId, description, assigned_by } = req.body;

    try {
        let targetUserId = assigneeId;

        if (!targetUserId && assigneeCustomId) {
            const { data: userProfile, error: profileError } = await supabase
                .from('profiles')
                .select('id')
                .eq('custom_profile_id', assigneeCustomId.trim().toUpperCase())
                .single();

            if (profileError || !userProfile) {
                return res.status(404).json({ success: false, message: `Member with ID ${assigneeCustomId} does not exist.` });
            }
            targetUserId = userProfile.id;
        }

        if (!targetUserId) {
            return res.status(400).json({ success: false, message: 'A valid assignee is required.' });
        }

        const { data, error } = await supabase
            .from('tasks')
            .insert([{
                title,
                description,
                assigned_to: targetUserId,
                assigned_by: assigned_by || req.user.id,
                status: 'assigned'
            }])
            .select();

        if (error) throw error;
        res.status(201).json({ success: true, data: data[0] });
    } catch (err) {
        console.error('Error deploying task:', err.message);
        res.status(500).json({ success: false, message: 'Could not deploy task.' });
    }
});

// 6. PATCH: Update task status/state changes
router.patch('/:taskId/status', protect, async (req, res) => {
    const { taskId } = req.params;
    const { status } = req.body;

    try {
        const { data, error } = await supabase
            .from('tasks')
            .update({ status, updated_at: new Date() })
            .eq('id', taskId)
            .select();

        if (error) throw error;
        res.status(200).json({ success: true, data: data[0] });
    } catch (err) {
        console.error('Error updating task status:', err.message);
        res.status(500).json({ success: false, message: 'Failed to update task state.' });
    }
});

module.exports = router;