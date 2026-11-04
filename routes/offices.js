/**
 * Pronettech Workspace - Regional Offices Router
 * File: routes/offices.js
 */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { protect, authorize } = require('../middleware/auth');

// 1. FETCH ALL REGIONAL OFFICES
router.get('/', protect, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('offices')
            .select('*')
            .order('branch_name', { ascending: true });

        if (error) throw error;
        return res.status(200).json({ success: true, data: data || [] });
    } catch (err) {
        console.error('Error fetching offices:', err.message);
        return res.status(500).json({ success: false, message: `Database error: ${err.message}` });
    }
});

// 2. ADMIN: CREATE NEW BRANCH OFFICE
router.post('/', protect, authorize('admin', 'global_admin', 'sub_admin'), async (req, res) => {
    const { branch_name, state, address } = req.body;

    if (!branch_name || !state) {
        return res.status(400).json({ success: false, message: 'Branch name and state are required.' });
    }

    try {
        const { data, error } = await supabase
            .from('offices')
            .insert([{
                branch_name,
                state,
                address: address || 'Address pending configuration',
                created_at: new Date().toISOString()
            }])
            .select();

        if (error) throw error;

        return res.status(201).json({
            success: true,
            message: 'Regional office branch registered successfully!',
            office: data[0]
        });
    } catch (err) {
        console.error('Error creating office:', err.message);
        return res.status(500).json({ success: false, message: `Database failure creating office.` });
    }
});

// 3. ADMIN: EDIT / UPDATE BRANCH OFFICE
router.put('/:id', protect, authorize('admin', 'global_admin', 'sub_admin'), async (req, res) => {
    const { id } = req.params;
    const { branch_name, state, address } = req.body;

    try {
        const { data, error } = await supabase
            .from('offices')
            .update({ branch_name, state, address })
            .eq('id', id)
            .select();

        if (error) throw error;

        return res.status(200).json({
            success: true,
            message: 'Office branch updated successfully!',
            office: data[0]
        });
    } catch (err) {
        console.error('Error updating office:', err.message);
        return res.status(500).json({ success: false, message: `Database failure updating office.` });
    }
});

// 4. ADMIN: DELETE BRANCH OFFICE
router.delete('/:id', protect, authorize('admin', 'global_admin', 'sub_admin'), async (req, res) => {
    const { id } = req.params;

    try {
        const { error } = await supabase
            .from('offices')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return res.status(200).json({ success: true, message: 'Office branch deleted successfully!' });
    } catch (err) {
        console.error('Error deleting office:', err.message);
        return res.status(500).json({ success: false, message: `Database failure deleting office.` });
    }
});

module.exports = router;