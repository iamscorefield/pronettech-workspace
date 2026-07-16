const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

// 1. Core Authentication Guard (Verifies if user is logged in)
const protect = async (req, res, next) => {
    let token;

    // Check if the token exists in cookies or inside the Authorization header
    if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access Denied: No authentication token provided.' });
    }

    try {
        // Decode and verify the local JWT token signature
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Pull the latest, fresh profile status and role directly from our Supabase profiles table
        const { data: userProfile, error } = await supabase
            .from('profiles')
            .select('id, role, status, office_id')
            .eq('id', decoded.id)
            .single();

        if (error || !userProfile) {
            return res.status(401).json({ success: false, message: 'User profile tracking entry not found.' });
        }

        // Enforce strict security status gates
        if (userProfile.status === 'banned') {
            return res.status(403).json({ success: false, message: 'Access Denied: This account has been suspended.' });
        }

        if (userProfile.status === 'pending') {
            return res.status(403).json({ success: false, message: 'Access Denied: Your account registration is still pending branch approval.' });
        }

        // Attach verified user metadata details seamlessly to the request object
        req.user = userProfile;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Authentication failed: Expired or malformed token string.' });
    }
};

// 2. Role-Based Authorization Guard (Verifies specific permissions)
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: `Forbidden Access: Your security tier (${req.user?.role || 'Guest'}) does not have permission for this sector.` 
            });
        }
        next();
    };
};

module.exports = { protect, authorize };