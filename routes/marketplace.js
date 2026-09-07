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
                certificate_url: `https://cdn.pronettech.com/certs/verified_${req.user.id}.pdf`
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

// ===================================================
// 3. SECURE PAYSTACK VERIFICATION (SOFTCOPY & RENEWAL)
// Reads PAYSTACK_SECRET_KEY automatically from .env
// ===================================================
router.post('/verify-payment', protect, async (req, res) => {
    const { reference, purpose } = req.body;

    console.log('[DEBUG] Incoming verify payload:', { reference, purpose, userId: req.user?.id });

    if (!reference) {
        return res.status(400).json({ success: false, message: 'Transaction reference is missing.' });
    }

    try {
        const rawSecret = process.env.PAYSTACK_SECRET_KEY;
        if (!rawSecret) {
            console.error('[DEBUG ERROR] PAYSTACK_SECRET_KEY environment variable is not defined in process.env!');
            return res.status(500).json({ success: false, message: 'Server configuration error: missing Secret Key.' });
        }

        const paystackSecret = rawSecret.trim();

        const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${paystackSecret}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await paystackRes.json();
        console.log('[DEBUG] Paystack API HTTP Status:', paystackRes.status);
        console.log('[DEBUG] Paystack API Response Body:', JSON.stringify(result));

        if (result.status && result.data && result.data.status === 'success') {
            const amountPaidInNaira = result.data.amount / 100; // Paystack sends amounts in kobo

            // A. Digital Softcopy Verification (₦2,000)
            if (purpose === 'softcopy') {
                if (amountPaidInNaira < 2000) {
                    console.warn(`[DEBUG WARNING] Softcopy payment amount insufficient: ₦${amountPaidInNaira}`);
                    return res.status(400).json({ success: false, message: 'Paid amount is below ₦2,000 threshold.' });
                }

                await supabase
                    .from('id_card_orders')
                    .insert([{
                        profile_id: req.user.id,
                        fulfillment_type: 'softcopy_only',
                        amount_paid: amountPaidInNaira,
                        payment_reference: reference,
                        status: 'paid'
                    }]);

                return res.status(200).json({ 
                    success: true, 
                    message: 'Payment verified! Softcopy unlocked.', 
                    downloadUnlocked: true 
                });
            }

            // B. Annual Membership Renewal Verification (₦3,000)
            if (purpose === 'renewal') {
                if (amountPaidInNaira < 3000) {
                    console.warn(`[DEBUG WARNING] Renewal payment amount insufficient: ₦${amountPaidInNaira}`);
                    return res.status(400).json({ success: false, message: 'Paid amount is below ₦3,000 threshold.' });
                }

                // Add 1 year to current expiration
                const oneYearFromNow = new Date();
                oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

                await supabase
                    .from('profiles')
                    .update({ 
                        status: 'active',
                        membership_expires_at: oneYearFromNow.toISOString()
                    })
                    .eq('id', req.user.id);

                return res.status(200).json({ 
                    success: true, 
                    message: 'Membership renewed successfully!', 
                    renewed: true 
                });
            }

            return res.status(400).json({ success: false, message: 'Invalid payment purpose specified.' });
        }

        console.error('[DEBUG REJECTION] Paystack transaction verify failed:', result.message || result);
        return res.status(400).json({ 
            success: false, 
            message: result.message || 'Paystack could not confirm this transaction.' 
        });
    } catch (err) {
        console.error('[DEBUG FATAL] Payment verification server error:', err);
        return res.status(500).json({ success: false, message: `Server transaction error: ${err.message}` });
    }
});

module.exports = router;