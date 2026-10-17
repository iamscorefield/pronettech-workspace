const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { protect } = require('../middleware/auth');

// 1. Get list of available contacts (Sponsors, Leaders, Admins, Downlines)
router.get('/contacts', protect, async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch all active profiles so users can message sponsors, leaders, or admins
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, role, custom_profile_id, avatar_url, status')
            .neq('id', userId)
            .order('first_name', { ascending: true });

        if (error) throw error;
        return res.status(200).json({ success: true, contacts: profiles || [] });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// 2. Get 1-on-1 messages with a specific recipient
router.get('/messages/:recipientId', protect, async (req, res) => {
    const senderId = req.user.id;
    const { recipientId } = req.params;

    try {
        const { data, error } = await supabase
            .from('direct_messages')
            .select('*')
            .or(`and(sender_id.eq.${senderId},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${senderId})`)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return res.status(200).json({ success: true, messages: data || [] });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// 3. Send a direct message
router.post('/messages', protect, async (req, res) => {
    const senderId = req.user.id;
    const { recipient_id, message } = req.body;

    if (!recipient_id || !message || message.trim() === '') {
        return res.status(400).json({ success: false, message: 'Recipient and message content are required.' });
    }

    try {
        const { data, error } = await supabase
            .from('direct_messages')
            .insert([{
                sender_id: senderId,
                recipient_id,
                message: message.trim()
            }])
            .select()
            .single();

        if (error) throw error;
        return res.status(201).json({ success: true, message: 'Message sent successfully.', data });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;