const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { protect, authorize } = require('../middleware/auth');

// 1. GET: Fetch tasks assigned to a specific user ID (Member View)
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
        console.error('Error loading tasks:', err.message);
        res.status(500).json({ success: false, message: 'Could not fetch tasks.' });
    }
});

// 2. GET: Fetch tasks for a specific regional office (Leader Monitor View)
// We dynamically join the profiles table to filter by office since tasks table does not have an office_id column
router.get('/office/:officeId', protect, authorize('leader', 'admin'), async (req, res) => {
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
router.get('/global/completed', protect, authorize('admin'), async (req, res) => {
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

// 4. POST: Deploy a new task to an assignee by their Custom Profile ID
router.post('/', protect, authorize('leader', 'admin'), async (req, res) => {
    const { title, assigneeCustomId, description, assigned_by } = req.body; // Removed office_id insertion parameter since it is handled by the user's profile relation

    try {
        // Find the user's UUID using their unique custom_profile_id
        const { data: userProfile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('custom_profile_id', assigneeCustomId)
            .single();

        if (profileError || !userProfile) {
            return res.status(404).json({ success: false, message: `Member with ID ${assigneeCustomId} does not exist.` });
        }

        // Insert task directly linked to their profile
        const { data, error } = await supabase
            .from('tasks')
            .insert([{
                title,
                description,
                assigned_to: userProfile.id,
                assigned_by,
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

// 5. PATCH: Update task status/state changes (Start Work, Mark Complete, Admin audit)
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