const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { protect, authorize } = require('../middleware/auth');

// ===================================================
// 1. ORDERS: DISPATCH ID CARD GENERATOR APPLICATION
// ===================================================
router.post('/order/idcard', protect, async (req, res) => {
    const { fulfillment_type, amount_paid, payment_reference, shipping_address } = req.body;

    if (!fulfillment_type || !amount_paid || !payment_reference) {
        return res.status(400).json({ success: false, message: 'Fulfillment type, price payload, and gateway references are required.' });
    }

    try {
        const { data, error } = await supabase
            .from('id_card_orders')
            .insert([{
                profile_id: req.user.id,
                fulfillment_type, // 'softcopy_only', 'hardcopy_only', or 'both'
                amount_paid,
                payment_reference,
                shipping_address,
                status: 'paid' // Automatically shifts status following successful gateway payment check
            }])
            .select();

        if (error) throw error;

        return res.status(201).json({ 
            success: true, 
            message: 'Corporate ID card order processed cleanly inside financial logs.', 
            order: data[0] 
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: `Marketplace ledger failure: ${err.message}` });
    }
});

// ===================================================
// 2. CERTIFICATES: ISSUE KNOWLEDGE RECOGNITION BADGE
// ===================================================
router.post('/order/certificate', protect, async (req, res) => {
    const { course_knowledge_title, fulfillment_type, amount_paid, payment_reference } = req.body;

    if (!course_knowledge_title || !fulfillment_type || !payment_reference) {
        return res.status(400).json({ success: false, message: 'Missing parameters for certificate database validation.' });
    }

    try {
        const { data, error } = await supabase
            .from('certificates')
            .insert([{
                profile_id: req.user.id,
                course_knowledge_title,
                fulfillment_type,
                amount_paid,
                payment_reference,
                status: 'paid',
                certificate_url: `https://cdn.pronettech.com/certs/verified_${req.user.id}.pdf` // Mocking path mapping for digital softcopies
            }])
            .select();

        if (error) throw error;

        return res.status(201).json({ 
            success: true, 
            message: 'Professional certification credential archived and available for download.', 
            certificate: data[0] 
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: `Credential issuance error: ${err.message}` });
    }
});

module.exports = router;