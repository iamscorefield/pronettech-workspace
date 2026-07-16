const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { protect, authorize } = require('../middleware/auth');

// ===================================================
// 1. ANNOUNCEMENTS: GET ALL REGIONAL & GLOBAL NOTICES
// ===================================================
router.get('/announcements', protect, async (req, res) => {
    try {
        const officeId = req.user.office_id;

        // Pull notifications that are either global or specifically target the employee's local branch
        const { data, error } = await supabase
            .from('announcements')
            .select('*, profiles(first_name, last_name, role)')
            .or(`is_global.eq.true,target_office_id.eq.${officeId}`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return res.status(200).json({ success: true, announcements: data });
    } catch (err) {
        return res.status(500).json({ success: false, message: `Database query failure: ${err.message}` });
    }
});

// ===================================================
// 2. FORUM: CREATE A NEW HELP DESK PROBLEM POST
// ===================================================
router.post('/forum/post', protect, async (req, res) => {
    const { title, body } = req.body;

    if (!title || !body) {
        return res.status(400).json({ success: false, message: 'Post title and description body are mandatory parameters.' });
    }

    try {
        const { data, error } = await supabase
            .from('forum_posts')
            .insert([{
                author_id: req.user.id,
                title,
                body
            }])
            .select();

        if (error) throw error;

        return res.status(201).json({ success: true, message: 'Ticket posted to the open forum community table.', post: data[0] });
    } catch (err) {
        return res.status(500).json({ success: false, message: `Forum logging error: ${err.message}` });
    }
});

// ===================================================
// 3. FORUM: OPTIMIZED FULL-TEXT SEARCH PAST CONVERSATIONS
// ===================================================
router.get('/forum/search', protect, async (req, res) => {
    const { query } = req.query; // Send query text in URL parameters: /search?query=network

    if (!query) {
        return res.status(400).json({ success: false, message: 'Search parameter term string is required.' });
    }

    try {
        // Leverages PostgreSQL tsvector index we set up in Phase 1 for fast problem scanning
        const { data, error } = await supabase
            .from('forum_posts')
            .select('id, title, body, created_at, profiles(first_name, last_name)')
            .textSearch('search_vector', query, {
                config: 'english',
                type: 'websearch'
            });

        if (error) throw error;

        return res.status(200).json({ success: true, results: data });
    } catch (err) {
        return res.status(500).json({ success: false, message: `Full-text system search error: ${err.message}` });
    }
});

// ===================================================
// 4. INCIDENTS: LEADER ESCALATION SUBMISSION
// ===================================================
router.post('/escalate', protect, authorize('leader'), async (req, res) => {
    const { subject, details, office_id, escalated_by } = req.body;

    if (!subject || !details || !office_id || !escalated_by) {
        return res.status(400).json({ success: false, message: 'Missing required incident parameters.' });
    }

    try {
        const { data, error } = await supabase
            .from('incidents')
            .insert([{
                subject,
                details,
                office_id,
                escalated_by,
                status: 'unresolved'
            }])
            .select();

        if (error) throw error;
        return res.status(201).json({ success: true, data: data[0] });
    } catch (err) {
        console.error('Error deploying incident report:', err.message);
        return res.status(500).json({ success: false, message: 'Incident dispatch failed.' });
    }
});

// ===================================================
// 5. INCIDENTS: ADMIN RETRIEVAL OF UNRESOLVED ALERTS
// ===================================================
router.get('/incidents', protect, authorize('admin'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('incidents')
            .select('*')
            .eq('status', 'unresolved')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.status(200).json({ success: true, data });
    } catch (err) {
        console.error('Failed to load incident database:', err.message);
        return res.status(500).json({ success: false, message: 'Incident retrieval failed.' });
    }
});

// ===================================================
// 6. INCIDENTS: ADMIN MARK TICKET AS RESOLVED
// ===================================================
router.patch('/incidents/:reportId/resolve', protect, authorize('admin'), async (req, res) => {
    const { reportId } = req.params;
    try {
        const { data, error } = await supabase
            .from('incidents')
            .update({ status: 'resolved', resolved_at: new Date().toISOString() })
            .eq('id', reportId)
            .select();

        if (error) throw error;
        return res.status(200).json({ success: true, data: data[0] });
    } catch (err) {
        console.error('Failed to resolve incident:', err.message);
        return res.status(500).json({ success: false, message: 'Incident resolution update failed.' });
    }
});

module.exports = router;