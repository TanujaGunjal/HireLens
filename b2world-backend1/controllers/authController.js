const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

// Validation rules
const isDev = process.env.NODE_ENV === 'development';

const registerValidation = [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  body('email').trim().isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').trim().custom((password) => {
    // In development: allow simple passwords
    if (isDev) {
      if (password.length < 4) {
        throw new Error('Password must be at least 4 characters');
      }
      return true;
    }
    // In production: enforce complexity
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter (A-Z)');
    }
    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter (a-z)');
    }
    if (!/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number (0-9)');
    }
    return true;
  })
];

const loginValidation = [
  body('email').trim().isEmail().normalizeEmail(),
  body('password').trim().notEmpty().withMessage('Password is required')
];

const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Format validation errors for better frontend display
      const errorMessages = errors.array().map(e => e.msg).join('; ');
      console.log(`❌ Registration validation failed:`);
      console.log(`   Email: ${req.body.email}`);
      console.log(`   Errors: ${errorMessages}`);
      return res.status(400).json({ 
        success: false, 
        message: errorMessages,  // Changed to show error directly as message
        error: errorMessages,
        errors: errors.array()
      });
    }

    const { name, email, password } = req.body;
    console.log(`📝 Registration attempt for email: ${email}`);
    
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      console.log(`❌ Email already registered: ${email}`);
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const user = new User({ name, email, passwordHash: password, role: 'USER' });
    await user.save();
    console.log(`✅ User created successfully: ${user._id}`);

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { token, user: user.toSafeObject() }
    });
  } catch (error) {
    console.error('❌ Register Error:', error);
    res.status(500).json({ success: false, message: 'Registration failed', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Format validation errors for better frontend display
      const errorMessages = errors.array().map(e => e.msg).join('; ');
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        error: errorMessages,
        errors: errors.array()
      });
    }

    const { email, password } = req.body;
    console.log(`🔍 Login attempt for email: ${email}`);
    
    const user = await User.findOne({ email });
    if (!user) {
      console.log(`❌ User not found with email: ${email}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    console.log(`✅ User found: ${user._id}`);
    const passwordMatch = await user.comparePassword(password);
    console.log(`🔐 Password match result: ${passwordMatch}`);
    
    if (!passwordMatch) {
      console.log(`❌ Password mismatch for user: ${email}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      console.log(`❌ Account inactive: ${email}`);
      return res.status(403).json({ success: false, message: 'Account inactive' });
    }

    user.lastLogin = new Date();
    await user.save();
    console.log(`✅ Login successful for user: ${email}`);

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { token, user: user.toSafeObject() }
    });
  } catch (error) {
    console.error('❌ Login Error:', error);
    res.status(500).json({ success: false, message: 'Login failed', error: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    res.status(200).json({ success: true, data: { user: req.user.toSafeObject() } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
};

module.exports = { register, registerValidation, login, loginValidation, getProfile };