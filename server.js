require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const supabase = require('./config/supabase');
const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const communityRoutes = require('./routes/community');
const marketplaceRoutes = require('./routes/marketplace');
const taskRoutes = require('./routes/tasks');
const downlineRoutes = require('./routes/downline');
const financeRoutes = require('./routes/finance');
const channelRoutes = require('./routes/channels');
const chatRoutes = require('./routes/chat');
const officesRouter = require('./routes/offices');

const app = express();
const PORT = process.env.PORT || 5000;

// Global Middleware Configuration
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static File Directory Mounts
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));
app.use('/views', express.static(path.join(publicPath, 'views')));
app.use('/css', express.static(path.join(publicPath, 'css')));
app.use('/assets', express.static(path.join(publicPath, 'assets')));

// Favicon Route
app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(publicPath, 'favicon.ico'));
});

// Architectural Baseline Health Route
app.get('/api/health', (req, res) => {
    res.status(200).json({ 
        status: "Online", 
        message: "Pronettech-Workspace Core Engine running smoothly." 
    });
});

// ===================================================
// OFFICES MANAGEMENT ENDPOINTS (CRUD)
// ===================================================

app.get('/api/offices', async (req, res) => {
    try {
        const { state } = req.query;
        let query = supabase
            .from('offices')
            .select('*')
            .order('branch_name', { ascending: true });

        if (state && state.trim() !== '') {
            query = query.ilike('state', `%${state.trim()}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        res.status(200).json({ success: true, data: data || [] });
    } catch (err) {
        console.error('Error fetching offices:', err.message);
        res.status(500).json({ success: false, message: 'Database query failed' });
    }
});

app.post('/api/offices', async (req, res) => {
    try {
        const { branch_name, state, address } = req.body;
        if (!branch_name) {
            return res.status(400).json({ success: false, message: 'Branch name is required.' });
        }

        const { data, error } = await supabase
            .from('offices')
            .insert([{ 
                branch_name, 
                state: state || 'Active Region', 
                address: address || '' 
            }])
            .select()
            .single();

        if (error) throw error;
        return res.status(201).json({ success: true, message: 'New office branch created successfully!', data });
    } catch (err) {
        console.error('Office creation failed:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Database failure creating office.' });
    }
});

app.put('/api/offices/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { branch_name, state, address } = req.body;

        const { data, error } = await supabase
            .from('offices')
            .update({ branch_name, state, address })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return res.status(200).json({ success: true, message: 'Office branch updated successfully!', data });
    } catch (err) {
        console.error('Error updating office:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Database failure updating office.' });
    }
});

app.delete('/api/offices/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('offices')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return res.status(200).json({ success: true, message: 'Office branch deleted successfully!' });
    } catch (err) {
        console.error('Error deleting office:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Database failure deleting office.' });
    }
});

// ===================================================
// ANNOUNCEMENTS & BROADCAST ENDPOINTS (CRUD & Aliases)
// ===================================================

app.get(['/api/announcements', '/api/auth/announcements', '/api/admin/announcements'], async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.status(200).json({ success: true, data: data || [] });
    } catch (err) {
        console.error('Error fetching announcements:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch announcements' });
    }
});

async function handleAnnouncementCreate(req, res) {
    try {
        const { title, content, message, is_global, target_office_id } = req.body;
        const finalContent = content || message;
        
        if (!title || !finalContent) {
            return res.status(400).json({ success: false, message: 'Title and content are required.' });
        }

        const { data, error } = await supabase
            .from('announcements')
            .insert([{ 
                title, 
                content: finalContent, 
                is_global: is_global !== undefined ? is_global : true,
                target_office_id: target_office_id || null
            }])
            .select()
            .single();

        if (error) throw error;
        return res.status(201).json({ success: true, message: 'Announcement created successfully!', data });
    } catch (err) {
        console.error('Announcement creation error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Database failure creating announcement.' });
    }
}

app.post(['/api/announcements', '/api/auth/announcements', '/api/broadcasts', '/api/admin/announcements', '/api/admin/broadcasts'], handleAnnouncementCreate);

async function handleAnnouncementUpdate(req, res) {
    try {
        const id = req.params.id || req.body.id;
        const { title, content, message, is_global, target_office_id } = req.body;
        const finalContent = content || message;
        
        if (!id) {
            return res.status(400).json({ success: false, message: 'Announcement ID is required for update.' });
        }

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (finalContent !== undefined) updateData.content = finalContent;
        if (is_global !== undefined) updateData.is_global = is_global;
        if (target_office_id !== undefined) updateData.target_office_id = target_office_id;

        const { data, error } = await supabase
            .from('announcements')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return res.status(200).json({ success: true, message: 'Announcement updated successfully!', data });
    } catch (err) {
        console.error('Error updating announcement:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Database failure updating announcement.' });
    }
}

app.put([
    '/api/announcements/:id', 
    '/api/auth/announcements/:id', 
    '/api/broadcasts/:id', 
    '/api/admin/announcements/:id', 
    '/api/admin/broadcasts/:id',
    '/api/announcements',
    '/api/auth/announcements',
    '/api/admin/announcements'
], handleAnnouncementUpdate);

async function handleAnnouncementDelete(req, res) {
    try {
        const id = req.params.id || req.query.id || req.body.id;
        
        if (!id) {
            return res.status(400).json({ success: false, message: 'Announcement ID is required for deletion.' });
        }

        const { error } = await supabase
            .from('announcements')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return res.status(200).json({ success: true, message: 'Announcement deleted successfully!' });
    } catch (err) {
        console.error('Error deleting announcement:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Database failure deleting announcement.' });
    }
}

app.delete([
    '/api/announcements/:id', 
    '/api/auth/announcements/:id', 
    '/api/broadcasts/:id', 
    '/api/admin/announcements/:id', 
    '/api/admin/broadcasts/:id',
    '/api/announcements',
    '/api/auth/announcements',
    '/api/admin/announcements'
], handleAnnouncementDelete);

// Mount Routing Modules
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/downline', downlineRoutes);
app.use('/api/downlines', downlineRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin/offices', officesRouter);

// Frontend Page Routing
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.get('/verify', (req, res) => {
    res.sendFile(path.join(publicPath, 'verify.html'));
});

app.get('/views/:page', (req, res) => {
    res.sendFile(path.join(publicPath, 'views', req.params.page));
});

// Fallback: send index.html for unmatched browser requests
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Local Development Server
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`===================================================`);
        console.log(`🚀 SENIOR ARCHITECT SYSTEM LOG`);
        console.log(`🛰️  Server initialized cleanly on port: ${PORT}`);
        console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
        console.log(`===================================================`);
    });
}

// Export the app instance for Vercel's serverless runtime
module.exports = app;