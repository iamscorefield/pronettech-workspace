const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { protect, authorize } = require('../middleware/auth');

// ===================================================
// 1. MY DIRECT DOWNLINES (FOR ALL USERS)
// Fetches members registered with caller's customId
// ===================================================
router.get('/my-network', protect, async (req, res) => {
    try {
        const callerCustomId = req.user.customId;

        if (!callerCustomId) {
            return res.status(400).json({ 
                success: false, 
                message: 'No Workspace ID registered on your profile to verify downlines.' 
            });
        }

        // 1. Fetch direct downline profiles
        const { data: downlines, error } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, phone_number, state, custom_profile_id, status, membership_expires_at, created_at, avatar_url, office:offices(branch_name)')
            .eq('sponsor_id', callerCustomId.trim().toUpperCase())
            .order('created_at', { ascending: false });

        if (error) throw error;

        // 2. Fetch softcopy orders to track ID card purchase statuses
        const downlineIds = (downlines || []).map(d => d.id);
        let softcopyPaidMap = {};

        if (downlineIds.length > 0) {
            const { data: orders } = await supabase
                .from('id_card_orders')
                .select('profile_id, status')
                .in('profile_id', downlineIds)
                .eq('status', 'paid');

            (orders || []).forEach(order => {
                softcopyPaidMap[order.profile_id] = true;
            });
        }

        const now = new Date();
        const enrichedDownlines = (downlines || []).map(member => {
            const expiresAt = member.membership_expires_at ? new Date(member.membership_expires_at) : null;
            const isMembershipPaid = expiresAt && expiresAt > now;

            return {
                ...member,
                is_annual_paid: Boolean(isMembershipPaid),
                has_paid_softcopy: Boolean(softcopyPaidMap[member.id])
            };
        });

        return res.status(200).json({
            success: true,
            totalDownlines: enrichedDownlines.length,
            sponsorId: callerCustomId,
            downlines: enrichedDownlines
        });
    } catch (err) {
        console.error('Downline network query error:', err);
        return res.status(500).json({ success: false, message: 'Failed to load downline network.' });
    }
});

// ===================================================
// 2. OFFICE BRANCH ROSTER (LEADERS & ADMINS)
// Fetches all physical staff assigned to leader's branch
// ===================================================
router.get('/office-roster', protect, authorize('leader', 'admin'), async (req, res) => {
    try {
        const officeId = req.user.office_id || req.query.office_id;

        if (!officeId) {
            return res.status(400).json({ 
                success: false, 
                message: 'No assigned regional branch office detected for your account.' 
            });
        }

        const { data: staff, error } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, phone_number, state, custom_profile_id, role, status, membership_expires_at, created_at, avatar_url')
            .eq('office_id', officeId)
            .order('first_name', { ascending: true });

        if (error) throw error;

        return res.status(200).json({
            success: true,
            totalStaff: (staff || []).length,
            roster: staff || []
        });
    } catch (err) {
        console.error('Branch roster query error:', err);
        return res.status(500).json({ success: false, message: 'Failed to load branch office personnel.' });
    }
});

// ===================================================
// 3. GLOBAL HIERARCHY TREE AUDIT (ADMIN ONLY)
// ===================================================
router.get('/tree', protect, authorize('admin'), async (req, res) => {
    try {
        const { data: networkProfiles, error } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, custom_profile_id, sponsor_id, role, status, state, office:offices(branch_name)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return res.status(200).json({
            success: true,
            totalWorkspaceAccounts: (networkProfiles || []).length,
            accounts: networkProfiles || []
        });
    } catch (err) {
        console.error('Admin network tree query error:', err);
        return res.status(500).json({ success: false, message: 'Failed to load enterprise organizational tree.' });
    }
});

module.exports = router;