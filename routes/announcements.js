/**
 * Pronettech Workspace - Announcements & Broadcasts Router
 */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { protect, authorize } = require('../middleware/auth');

// 1. FETCH ALL ANNOUNCEMENTS
router.get('/', protect, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.status(200).json({ success: true, data: data || [] });
    } catch (err) {
        console.error('Error fetching announcements:', err.message);
        return res.status(500).json({ success: false, message: `Database error: ${err.message}` });
    }
});

// 2. ADMIN: CREATE ANNOUNCEMENT
router.post('/', protect, authorize('admin', 'global_admin', 'sub_admin'), async (req, res) => {
    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).json({ success: false, message: 'Title and content are required.' });
    }

    try {
        const { data, error } = await supabase
            .from('announcements')
            .insert([{
                title,
                content,
                author_name: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'System Administration',
                created_at: new Date().toISOString()
            }])
            .select();

        if (error) throw error;
        return res.status(201).json({ success: true, message: 'Announcement published successfully!', data: data[0] });
    } catch (err) {
        console.error('Error creating announcement:', err.message);
        return res.status(500).json({ success: false, message: 'Database failure creating announcement.' });
    }
});

// 3. ADMIN: EDIT / UPDATE ANNOUNCEMENT
router.put('/:id', protect, authorize('admin', 'global_admin', 'sub_admin'), async (req, res) => {
    const { id } = req.params;
    const { title, content } = req.body;

    try {
        const { data, error } = await supabase
            .from('announcements')
            .update({ title, content })
            .eq('id', id)
            .select();

        if (error) throw error;
        return res.status(200).json({ success: true, message: 'Announcement updated successfully!', data: data[0] });
    } catch (err) {
        console.error('Error updating announcement:', err.message);
        return res.status(500).json({ success: false, message: 'Database failure updating announcement.' });
    }
});

// 4. ADMIN: DELETE ANNOUNCEMENT
router.delete('/:id', protect, authorize('admin', 'global_admin', 'sub_admin'), async (req, res) => {
    const { id } = req.params;

    try {
        const { error } = await supabase
            .from('announcements')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return res.status(200).json({ success: true, message: 'Announcement deleted successfully!' });
    } catch (err) {
        console.error('Error deleting announcement:', err.message);
        return res.status(500).json({ success: false, message: `Database failure deleting announcement.` });
    }
});

module.exports = router;