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

// Dynamic Office Fetching Route directly connected to Supabase
app.get('/api/offices', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('offices')
            .select('*')
            .order('branch_name', { ascending: true });

        if (error) throw error;
        
        res.status(200).json(data);
    } catch (err) {
        console.error('Error fetching offices:', err.message);
        res.status(500).json({ success: false, message: 'Database query failed' });
    }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/tasks', taskRoutes);

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