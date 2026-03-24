const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { sequelize, User, Project, Task } = require('./database/setup');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key-here';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

app.use(express.json());

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Role-based Middleware
const requireManager = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (req.user.role !== 'manager' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Manager or admin role required.' });
  }
  
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }
  
  next();
};

// Optional: Middleware for employees to only access their own tasks
const requireTaskOwner = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Admins and managers can access all tasks
  if (req.user.role === 'admin' || req.user.role === 'manager') {
    return next();
  }
  
  const taskId = req.params.id;
  try {
    const task = await Task.findByPk(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    if (task.assignedTo !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You can only update your own tasks.' });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ error: 'Error checking task ownership' });
  }
};

// ==================== AUTHENTICATION ROUTES ====================

// Register new user
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, role = 'employee' } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Validate role
    if (role && !['employee', 'manager', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be employee, manager, or admin' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role
    });
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error registering user' });
  }
});

// Login user
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error logging in' });
  }
});

// Logout (stateless JWT - just inform client)
app.post('/api/logout', (req, res) => {
  res.json({ message: 'Logout successful. Please discard your token on client side.' });
});

// ==================== USER ROUTES ====================

// Get current user profile
app.get('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'email', 'role']
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching profile' });
  }
});

// Get all users (Admin only)
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'name', 'email', 'role']
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching users' });
  }
});

// ==================== PROJECT ROUTES ====================

// Get all projects (all authenticated users)
app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    const projects = await Project.findAll({
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
        { model: Task }
      ]
    });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching projects' });
  }
});

// Get single project
app.get('/api/projects/:id', authenticateToken, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
        { model: Task, include: [{ model: User, as: 'assignee', attributes: ['id', 'name', 'email'] }] }
      ]
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching project' });
  }
});

// Create project (Manager/Admin only)
app.post('/api/projects', authenticateToken, requireManager, async (req, res) => {
  try {
    const { name, description, status } = req.body;
    
    const project = await Project.create({
      name,
      description,
      status: status || 'active',
      createdBy: req.user.id
    });
    
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: 'Error creating project' });
  }
});

// Update project (Manager/Admin only)
app.put('/api/projects/:id', authenticateToken, requireManager, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const { name, description, status } = req.body;
    await project.update({ name, description, status });
    
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Error updating project' });
  }
});

// Delete project (Admin only)
app.delete('/api/projects/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    await project.destroy();
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting project' });
  }
});

// ==================== TASK ROUTES ====================

// Get tasks for a project
app.get('/api/projects/:id/tasks', authenticateToken, async (req, res) => {
  try {
    const tasks = await Task.findAll({
      where: { projectId: req.params.id },
      include: [{ model: User, as: 'assignee', attributes: ['id', 'name', 'email'] }]
    });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching tasks' });
  }
});

// Create task in project (Manager/Admin only)
app.post('/api/projects/:id/tasks', authenticateToken, requireManager, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const { title, description, status, assignedTo } = req.body;
    
    const task = await Task.create({
      title,
      description,
      status: status || 'pending',
      projectId: req.params.id,
      assignedTo: assignedTo || null
    });
    
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: 'Error creating task' });
  }
});

// Update task (Employees can update their own tasks, Managers/Admins can update any)
app.put('/api/tasks/:id', authenticateToken, requireTaskOwner, async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const { title, description, status, assignedTo } = req.body;
    
    // If employee is updating, only allow status change
    if (req.user.role === 'employee') {
      await task.update({ status });
    } else {
      // Managers and admins can update all fields
      await task.update({ title, description, status, assignedTo });
    }
    
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Error updating task' });
  }
});

// Delete task (Manager/Admin only)
app.delete('/api/tasks/:id', authenticateToken, requireManager, async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    await task.destroy();
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting task' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, async () => {
  try {
    await sequelize.authenticate();
    console.log(`Server running on port ${PORT}`);
    console.log(`Database connected`);
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
});