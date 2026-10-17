const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { protect, authorize } = require('../middleware/auth');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// 1. Get all community channels
router.get('/', protect, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('channels')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;
        return res.status(200).json({ success: true, channels: data || [] });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// 2. Admin create channel
router.post('/', protect, authorize('admin', 'global_admin'), async (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Channel name is required.' });

    try {
        const { data, error } = await supabase
            .from('channels')
            .insert([{ name: name.trim(), description: description ? description.trim() : '', created_by: req.user.id }])
            .select()
            .single();

        if (error) throw error;
        return res.status(201).json({ success: true, message: 'Channel created successfully.', channel: data });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// 3. Get messages for a channel (with profile details joined)
router.get('/:channelId/messages', protect, async (req, res) => {
    const { channelId } = req.params;
    try {
        const { data, error } = await supabase
            .from('channel_messages')
            .select('id, channel_id, user_id, content, image_url, link_url, created_at, profiles(first_name, last_name, role, avatar_url, custom_profile_id)')
            .eq('channel_id', channelId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return res.status(200).json({ success: true, messages: data || [] });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// 4. Post message to a channel (Supports text, image, and link)
router.post('/:channelId/messages', protect, upload.single('image'), async (req, res) => {
    const { channelId } = req.params;
    const { content, link_url } = req.body;

    if (!content && !req.file) {
        return res.status(400).json({ success: false, message: 'Message content or image attachment is required.' });
    }

    try {
        let imageUrl = null;
        if (req.file) {
            const fileExt = req.file.originalname.split('.').pop();
            const filePath = `channel-${channelId}-${Date.now()}.${fileExt}`;
            const { error: uploadErr } = await supabase.storage.from('avatars').upload(filePath, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: true
            });
            if (!uploadErr) {
                const { data: pubData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                imageUrl = pubData.publicUrl;
            }
        }

        const { data, error } = await supabase
            .from('channel_messages')
            .insert([{
                channel_id: channelId,
                user_id: req.user.id,
                content: content ? content.trim() : '',
                image_url: imageUrl,
                link_url: link_url ? link_url.trim() : null
            }])
            .select()
            .single();

        if (error) throw error;
        return res.status(201).json({ success: true, message: 'Message posted.', messageData: data });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;