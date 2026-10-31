/**
 * Pronettech Workspace - Financial Management Router
 * File: routes/finance.js
 */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { protect, authorize } = require('../middleware/auth');

/**
 * 1. GET MEMBER CASHBOOK & TRANSACTIONS (WITH AUTO-DEDUCTION SYNC & TYPE STAMPING)
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

        // Fetch transactions (Deposits / Inflows)
        const { data: rawTransactions, error: txError } = await supabase
            .from('financial_transactions')
            .select('*')
            .eq('cashbook_id', cashbook.id)
            .order('created_at', { ascending: false });

        if (txError) throw txError;

        // Fetch withdrawals (Cash-outs / Outflows)
        const { data: rawWithdrawals, error: wError } = await supabase
            .from('withdrawal_requests')
            .select('*')
            .eq('cashbook_id', cashbook.id)
            .order('created_at', { ascending: false });

        if (wError) throw wError;

        // Stamp explicit transaction types for frontend automation
        const transactions = (rawTransactions || []).map(tx => ({
            ...tx,
            transaction_type: 'deposit',
            purpose_display: tx.category || tx.purpose || tx.description || 'Workspace Deposit'
        }));

        const withdrawals = (rawWithdrawals || []).map(w => ({
            ...w,
            transaction_type: 'withdrawal',
            purpose_display: w.purpose || 'Cash-out Withdrawal'
        }));

        // AUTO-SYNC SAFEGUARD: Automatically detect any approved withdrawals not yet reflected in balance
        let totalApprovedWithdrawals = 0;
        if (rawWithdrawals) {
            rawWithdrawals.forEach(w => {
                if (w.status === 'approved' || w.status === 'paid') {
                    totalApprovedWithdrawals += parseFloat(w.amount || 0);
                }
            });
        }

        // Calculate expected balance from all approved deposits minus approved withdrawals
        let totalApprovedDeposits = 0;
        if (rawTransactions) {
            rawTransactions.forEach(tx => {
                if (['approved', 'acknowledged'].includes(tx.status)) {
                    totalApprovedDeposits += parseFloat(tx.amount || 0);
                }
            });
        }

        const correctBalance = totalApprovedDeposits - totalApprovedWithdrawals;

        // If current balance doesn't match the true ledger calculation, auto-correct it seamlessly
        if (parseFloat(cashbook.current_balance) !== correctBalance) {
            await supabase
                .from('member_cashbooks')
                .update({ current_balance: correctBalance, updated_at: new Date() })
                .eq('id', cashbook.id);

            cashbook.current_balance = correctBalance;
        }

        res.json({ success: true, cashbook, transactions, withdrawals });
    } catch (err) {
        console.error('Error fetching cashbook:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * 2. MEMBER / LEADER ADDS DEPOSIT OR CASH-IN ENTRY
 */
router.post('/cashbook/earning', protect, async (req, res) => {
    try {
        const { userId, category, amount, description, proofUrl, type = 'deposit' } = req.body;
        const senderId = req.user.id;
        const userRole = req.user.role;

        const targetUserId = userId || senderId;
        const isLeaderAction = userRole !== 'member';

        if (!targetUserId || !amount) {
            return res.status(400).json({ success: false, message: 'Missing required amount or target user.' });
        }

        let { data: cashbook } = await supabase
            .from('member_cashbooks')
            .select('*')
            .eq('user_id', targetUserId)
            .single();

        if (!cashbook) {
            const { data: newCb, error: createErr } = await supabase
                .from('member_cashbooks')
                .insert([{ user_id: targetUserId, total_earned: 0, current_balance: 0 }])
                .select()
                .single();
            if (createErr) throw createErr;
            cashbook = newCb;
        }

        const parsedAmount = parseFloat(amount);
        let initialStatus = 'pending_leader_approval';
        let submittedByRole = 'member';

        if (isLeaderAction) {
            submittedByRole = userRole;
            initialStatus = userRole === 'admin' || userRole === 'global_admin' ? 'approved' : 'pending_admin_approval';
        }

        const { data: txData, error: txError } = await supabase
            .from('financial_transactions')
            .insert([{
                cashbook_id: cashbook.id,
                user_id: targetUserId,
                category: category || 'Deposit',
                type,
                amount: parsedAmount,
                description: description || (isLeaderAction ? 'Recorded by Leader/Admin' : 'Member self-deposit request'),
                proof_image_url: proofUrl,
                status: initialStatus,
                submitted_by_role: submittedByRole,
                recorded_by: senderId
            }])
            .select()
            .single();

        if (txError) throw txError;

        if (initialStatus === 'approved') {
            const newTotalEarned = parseFloat(cashbook.total_earned) + parsedAmount;
            const newBalance = parseFloat(cashbook.current_balance) + parsedAmount;

            await supabase
                .from('member_cashbooks')
                .update({ total_earned: newTotalEarned, current_balance: newBalance, updated_at: new Date() })
                .eq('id', cashbook.id);
        }

        res.json({ success: true, message: 'Deposit entry submitted successfully!', transaction: txData });
    } catch (err) {
        console.error('Error recording deposit:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * 3. LEADER / ADMIN EVALUATES / APPROVES DEPOSIT / EARNING
 */
router.patch('/transactions/:id/evaluate', protect, authorize('leader', 'team_leader', 'sub_admin', 'admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; 

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid evaluation status.' });
        }

        const { data: tx, error: txFetchErr } = await supabase
            .from('financial_transactions')
            .select('*')
            .eq('id', id)
            .single();

        if (txFetchErr || !tx) throw new Error('Transaction record not found.');

        const { error: updateErr } = await supabase
            .from('financial_transactions')
            .update({ status: status === 'approved' ? 'approved' : 'rejected' })
            .eq('id', id);

        if (updateErr) throw updateErr;

        if (status === 'approved') {
            const { data: cashbook } = await supabase
                .from('member_cashbooks')
                .select('*')
                .eq('id', tx.cashbook_id)
                .single();

            if (cashbook) {
                const newTotalEarned = parseFloat(cashbook.total_earned) + parseFloat(tx.amount);
                const newBalance = parseFloat(cashbook.current_balance) + parseFloat(tx.amount);

                await supabase
                    .from('member_cashbooks')
                    .update({ total_earned: newTotalEarned, current_balance: newBalance, updated_at: new Date() })
                    .eq('id', cashbook.id);
            }
        }

        res.json({ success: true, message: `Transaction request ${status} successfully!` });
    } catch (err) {
        console.error('Error evaluating transaction:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * 4. MEMBER ACKNOWLEDGES OR DISPUTES TRANSACTION ("Not Accurate")
 */
router.patch('/transactions/:id/response', protect, async (req, res) => {
    try {
        const { id } = req.params;
        const { action, disputeReason } = req.body; 
        const userId = req.user.id;

        const { data: tx, error: txErr } = await supabase
            .from('financial_transactions')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (txErr || !tx) throw new Error('Transaction not found or unauthorized.');

        let newStatus = tx.status;
        let updatePayload = {};

        if (action === 'acknowledge') {
            newStatus = 'acknowledged';
            updatePayload = { status: newStatus };

            const { data: cashbook } = await supabase
                .from('member_cashbooks')
                .select('*')
                .eq('id', tx.cashbook_id)
                .single();

            if (cashbook) {
                const newTotalEarned = parseFloat(cashbook.total_earned) + parseFloat(tx.amount);
                const newBalance = parseFloat(cashbook.current_balance) + parseFloat(tx.amount);

                await supabase
                    .from('member_cashbooks')
                    .update({ total_earned: newTotalEarned, current_balance: newBalance, updated_at: new Date() })
                    .eq('id', cashbook.id);
            }
        } else if (action === 'dispute') {
            newStatus = 'disputed';
            updatePayload = { status: newStatus, dispute_reason: disputeReason || 'Marked not accurate by member.' };
        } else {
            return res.status(400).json({ success: false, message: 'Invalid response action.' });
        }

        const { error } = await supabase
            .from('financial_transactions')
            .update(updatePayload)
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true, message: `Transaction response recorded as ${newStatus}.` });
    } catch (err) {
        console.error('Error responding to transaction:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * 5. MEMBER REQUESTS WITHDRAWAL
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
 * 6. LEADER FORWARDS WITHDRAWAL TO ADMIN
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
 * 7. ADMIN APPROVES / REJECTS WITHDRAWAL (DEDUCTS BALANCE IMMEDIATELY)
 */
router.patch('/withdrawal/:id/evaluate', protect, authorize('admin', 'sub_admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; 

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid evaluation status.' });
        }

        const { data: withdrawal, error: wErr } = await supabase
            .from('withdrawal_requests')
            .select('*')
            .eq('id', id)
            .single();

        if (wErr || !withdrawal) throw new Error('Withdrawal request not found.');

        if (withdrawal.status === 'rejected') {
            return res.status(400).json({ success: false, message: 'This withdrawal has already been rejected.' });
        }

        const updatePayload = { status };
        if (status === 'approved') updatePayload.admin_approved_at = new Date();

        const { error } = await supabase
            .from('withdrawal_requests')
            .update(updatePayload)
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true, message: `Withdrawal request ${status} successfully!` });
    } catch (err) {
        console.error('Error evaluating withdrawal:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * 8. LEADER / ADMIN MARKS WITHDRAWAL PAID & ATTACHES RECEIPT
 */
router.patch('/withdrawal/:id/pay', protect, authorize('leader', 'team_leader', 'admin', 'sub_admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { receiptUrl } = req.body;

        const { error } = await supabase
            .from('withdrawal_requests')
            .update({ status: 'paid', admin_receipt_url: receiptUrl })
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true, message: 'Payout marked as paid successfully!' });
    } catch (err) {
        console.error('Error processing payout:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * 9. OFFICE LEDGERS (EXPENSES & REVENUE)
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