import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../utils/supabaseAdmin.js';
import bcrypt from 'bcryptjs';
import { Router } from 'express';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const SALT_ROUNDS = 10;

// Register a new user
router.post('/register', async (req, res) => {
  try {
    let { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    email = email.toLowerCase();
    if (!email.endsWith('@example.com') && !email.endsWith('@gmail.com')) {
      return res.status(400).json({ error: 'Invalid email domain' });
    }
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const { data, error } = await supabaseAdmin.from('users').insert({ email, password: hashed }).select().single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'User already exists' });
      throw error;
    }
    const role = data.role || 'user';
    const token = jwt.sign({ id: data.id, email: data.email, role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: data.id, email: data.email, role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login existing user
router.post('/login', async (req, res) => {
  try {
    let { email, password } = req.body;
    email = email.toLowerCase();
    const { data: user, error } = await supabaseAdmin.from('users').select('id, email, password, role').eq('email', email).single();
    if (error || !user) return res.status(401).json({ error: 'Invalid credentials' });
    // Enforce domain restrictions based on role
    if (user.role === 'admin' && !email.endsWith('@example.com')) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (user.role !== 'admin' && !email.endsWith('@gmail.com')) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    
    const role = user.role || 'user';
    const token = jwt.sign({ id: user.id, email: user.email, role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Change password endpoint
router.post('/change-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing token' });
    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords required' });
    }
    // fetch user
    const { data: user, error } = await supabaseAdmin.from('users').select('password').eq('id', payload.id).single();
    if (error || !user) return res.status(404).json({ error: 'User not found' });
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ error: 'Current password incorrect' });
    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const { error: updateError } = await supabaseAdmin.from('users').update({ password: hashed }).eq('id', payload.id);
    if (updateError) return res.status(500).json({ error: 'Failed to update password' });
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
