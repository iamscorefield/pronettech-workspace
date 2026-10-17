/**
 * Pronettech Workspace - Financial Management Router
 * File: routes/finance.js
 */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { protect, authorize } = require('../middleware/auth');

/**
 * 1. GET MEMBER CASHBOOK & TRANSACTIONS
 */
router.get('/cashbook/:userId', protect, async (req, res) => {
    try {
        const { userId } = req.params;

        // Fetch cashbook
        let { data: cashbook, error: cbError } = await supabase
            .from('member_cashbooks')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (cbError && cbError.code === 'PGRST116') {
            // Auto-create cashbook if it doesn't exist yet
            const { data: newCb, error: createErr } = await supabase
                .from('member_cashbooks')
                .insert([{ user_id: userId, total_earned: 0, current_balance: 0 }])
                .select()
                .single();
            if (createErr) throw createErr;
            cashbook = newCb;
        } else if (cbError) {
            throw cbError;
        }

        // Fetch transactions
        const { data: transactions, error: txError } = await supabase
            .from('financial_transactions')
            .select('*')
            .eq('cashbook_id', cashbook.id)
            .order('created_at', { ascending: false });

        if (txError) throw txError;

        // Fetch withdrawals
        const { data: withdrawals, error: wError } = await supabase
            .from('withdrawal_requests')
            .select('*')
            .eq('cashbook_id', cashbook.id)
            .order('created_at', { ascending: false });

        if (wError) throw wError;

        res.json({ success: true, cashbook, transactions, withdrawals });
    } catch (err) {
        console.error('Error fetching cashbook:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * 2. LEADER ADDS EARNING TO MEMBER CASHBOOK
 */
router.post('/cashbook/earning', protect, authorize('leader', 'team_leader', 'sub_admin', 'admin'), async (req, res) => {
    try {
        const { userId, category, amount, description, proofUrl } = req.body;
        const leaderId = req.user.id;

        if (!userId || !category || !amount) {
            return res.status(400).json({ success: false, message: 'Missing required fields.' });
        }

        // Get or create member cashbook
        let { data: cashbook } = await supabase
            .from('member_cashbooks')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (!cashbook) {
            const { data: newCb, error: createErr } = await supabase
                .from('member_cashbooks')
                .insert([{ user_id: userId, leader_id: leaderId, total_earned: 0, current_balance: 0 }])
                .select()
                .single();
            if (createErr) throw createErr;
            cashbook = newCb;
        }

        const parsedAmount = parseFloat(amount);

        // Insert transaction
        const { error: txError } = await supabase
            .from('financial_transactions')
            .insert([{
                cashbook_id: cashbook.id,
                user_id: userId,
                category,
                amount: parsedAmount,
                description,
                proof_url: proofUrl,
                recorded_by: leaderId
            }]);

        if (txError) throw txError;

        // Update cashbook balances
        const newTotalEarned = parseFloat(cashbook.total_earned) + parsedAmount;
        const newBalance = parseFloat(cashbook.current_balance) + parsedAmount;

        const { error: updateErr } = await supabase
            .from('member_cashbooks')
            .update({ total_earned: newTotalEarned, current_balance: newBalance, updated_at: new Date() })
            .eq('id', cashbook.id);

        if (updateErr) throw updateErr;

        res.json({ success: true, message: 'Earning recorded successfully!' });
    } catch (err) {
        console.error('Error recording earning:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * 3. MEMBER REQUESTS WITHDRAWAL
 */
router.post('/withdrawal/request', protect, async (req, res) => {
    try {
        const { amount, purpose } = req.body;
        const userId = req.user.id;

        const { data: cashbook } = await supabase
            .from('member_cashbooks')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (!cashbook || parseFloat(cashbook.current_balance) < parseFloat(amount)) {
            return res.status(400).json({ success: false, message: 'Insufficient balance for this withdrawal request.' });
        }

        const { error } = await supabase
            .from('withdrawal_requests')
            .insert([{
                user_id: userId,
                cashbook_id: cashbook.id,
                amount: parseFloat(amount),
                purpose,
                status: 'pending'
            }]);

        if (error) throw error;

        res.json({ success: true, message: 'Withdrawal request submitted successfully!' });
    } catch (err) {
        console.error('Error requesting withdrawal:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * 4. LEADER FORWARDS WITHDRAWAL TO ADMIN
 */
router.patch('/withdrawal/:id/forward', protect, authorize('leader', 'team_leader', 'sub_admin', 'admin'), async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('withdrawal_requests')
            .update({ status: 'forwarded', leader_forwarded_at: new Date() })
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true, message: 'Withdrawal request forwarded to Admin.' });
    } catch (err) {
        console.error('Error forwarding withdrawal:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * 5. ADMIN APPROVES / REJECTS WITHDRAWAL
 */
router.patch('/withdrawal/:id/evaluate', protect, authorize('admin', 'sub_admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'approved' or 'rejected'

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid evaluation status.' });
        }

        const updatePayload = { status };
        if (status === 'approved') updatePayload.admin_approved_at = new Date();

        const { error } = await supabase
            .from('withdrawal_requests')
            .update(updatePayload)
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true, message: `Withdrawal request ${status}.` });
    } catch (err) {
        console.error('Error evaluating withdrawal:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * 6. LEADER / ADMIN MARKS WITHDRAWAL PAID & ATTACHES RECEIPT
 */
router.patch('/withdrawal/:id/pay', protect, authorize('leader', 'team_leader', 'admin', 'sub_admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { receiptUrl } = req.body;

        const { data: withdrawal, error: wErr } = await supabase
            .from('withdrawal_requests')
            .select('*')
            .eq('id', id)
            .single();

        if (wErr || !withdrawal) throw new Error('Withdrawal request not found.');

        const { data: cashbook } = await supabase
            .from('member_cashbooks')
            .select('*')
            .eq('id', withdrawal.cashbook_id)
            .single();

        const newBalance = parseFloat(cashbook.current_balance) - parseFloat(withdrawal.amount);

        await supabase
            .from('member_cashbooks')
            .update({ current_balance: newBalance })
            .eq('id', cashbook.id);

        const { error } = await supabase
            .from('withdrawal_requests')
            .update({ status: 'paid', admin_receipt_url: receiptUrl })
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true, message: 'Payout completed and receipt attached successfully!' });
    } catch (err) {
        console.error('Error processing payout:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * 7. OFFICE LEDGERS (EXPENSES & REVENUE)
 */
router.post('/office/ledger', protect, authorize('leader', 'team_leader', 'admin', 'sub_admin'), async (req, res) => {
    try {
        const { officeId, type, category, amount, description } = req.body;

        const { error } = await supabase
            .from('office_ledgers')
            .insert([{
                office_id: officeId,
                type,
                category,
                amount: parseFloat(amount),
                description,
                recorded_by: req.user.id
            }]);

        if (error) throw error;

        res.json({ success: true, message: 'Office ledger entry saved successfully!' });
    } catch (err) {
        console.error('Error saving office ledger:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/office/:officeId', protect, async (req, res) => {
    try {
        const { officeId } = req.params;

        const { data: ledgers, error } = await supabase
            .from('office_ledgers')
            .select('*')
            .eq('office_id', officeId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ success: true, ledgers });
    } catch (err) {
        console.error('Error fetching office ledgers:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;