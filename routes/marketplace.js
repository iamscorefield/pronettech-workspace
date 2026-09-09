const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { protect, authorize } = require('../middleware/auth');

// ===================================================
// 1. ENTITLEMENTS TELEMETRY (LIVE PAYMENT STATUS CHECK)
// Checks if Softcopy & Annual Renewal are currently paid
// ===================================================
router.get('/my-entitlements', protect, async (req, res) => {
    try {
        const userId = req.user.id;

        // Check user profile for active validity & softcopy flag
        const { data: profile, error: profErr } = await supabase
            .from('profiles')
            .select('membership_expires_at, has_paid_softcopy, status')
            .eq('id', userId)
            .single();

        if (profErr) throw profErr;

        // Check ID card orders table for any paid softcopy orders
        const { data: softcopyOrders } = await supabase
            .from('id_card_orders')
            .select('id')
            .eq('profile_id', userId)
            .eq('status', 'paid')
            .in('fulfillment_type', ['softcopy_only', 'both']);

        const now = new Date();
        const expiresAt = profile?.membership_expires_at ? new Date(profile.membership_expires_at) : null;
        let isMembershipActive = false;
        let daysRemaining = 0;

        if (expiresAt && !isNaN(expiresAt.getTime()) && expiresAt > now) {
            isMembershipActive = true;
            daysRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
        }

        const hasPaidSoftcopy = Boolean(profile?.has_paid_softcopy) || (Array.isArray(softcopyOrders) && softcopyOrders.length > 0);

        return res.status(200).json({
            success: true,
            entitlements: {
                hasPaidSoftcopy,
                isMembershipActive,
                daysRemaining,
                expiresAt: profile?.membership_expires_at || null,
                accountStatus: profile?.status || 'pending'
            }
        });
    } catch (err) {
        console.error('Error querying entitlements:', err);
        return res.status(500).json({ success: false, message: 'Could not fetch entitlement status.' });
    }
});

// ===================================================
// 2. ORDERS: DISPATCH ID CARD GENERATOR APPLICATION
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
                fulfillment_type,
                amount_paid,
                payment_reference,
                shipping_address,
                status: 'paid'
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
// 3. CERTIFICATES: ISSUE KNOWLEDGE RECOGNITION BADGE
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
// 4. SECURE PAYSTACK VERIFICATION (SOFTCOPY & RENEWAL)
// ===================================================
router.post('/verify-payment', protect, async (req, res) => {
    const { reference, purpose } = req.body;

    if (!reference) {
        return res.status(400).json({ success: false, message: 'Transaction reference is missing.' });
    }

    try {
        const rawSecret = process.env.PAYSTACK_SECRET_KEY;
        if (!rawSecret) {
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

        if (result.status && result.data && result.data.status === 'success') {
            const amountPaidInNaira = result.data.amount / 100;

            // A. Digital Softcopy Verification (₦2,000)
            if (purpose === 'softcopy') {
                if (amountPaidInNaira < 2000) {
                    return res.status(400).json({ success: false, message: 'Paid amount is below ₦2,000 threshold.' });
                }

                // Insert into orders table
                await supabase
                    .from('id_card_orders')
                    .insert([{
                        profile_id: req.user.id,
                        fulfillment_type: 'softcopy_only',
                        amount_paid: amountPaidInNaira,
                        payment_reference: reference,
                        status: 'paid'
                    }]);

                // Update has_paid_softcopy directly on profiles
                await supabase
                    .from('profiles')
                    .update({ has_paid_softcopy: true })
                    .eq('id', req.user.id);

                return res.status(200).json({ 
                    success: true, 
                    message: 'Payment verified! Softcopy unlocked.', 
                    downloadUnlocked: true 
                });
            }

            // B. Annual Membership Renewal Verification (₦3,000)
            if (purpose === 'renewal') {
                if (amountPaidInNaira < 3000) {
                    return res.status(400).json({ success: false, message: 'Paid amount is below ₦3,000 threshold.' });
                }

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

        return res.status(400).json({ 
            success: false, 
            message: result.message || 'Paystack could not confirm this transaction.' 
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: `Server transaction error: ${err.message}` });
    }
});

module.exports = router;