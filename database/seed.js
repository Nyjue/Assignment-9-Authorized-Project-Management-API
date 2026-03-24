const bcrypt = require('bcrypt');
const { sequelize, User, Project, Task } = require('./setup');

async function seed() {
  try {
    await sequelize.sync({ force: true });
    
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Create users with roles
    const users = await User.bulkCreate([
      { name: 'John Doe', email: 'john@company.com', password: hashedPassword, role: 'employee' },
      { name: 'Sarah Smith', email: 'sarah@company.com', password: hashedPassword, role: 'manager' },
      { name: 'Mike Johnson', email: 'mike@company.com', password: hashedPassword, role: 'admin' }
    ]);
    
    // Create projects
    const projects = await Project.bulkCreate([
      { name: 'Website Redesign', description: 'Redesign company website', status: 'active', createdBy: users[1].id },
      { name: 'Mobile App Development', description: 'Create mobile app for customers', status: 'active', createdBy: users[2].id },
      { name: 'Database Migration', description: 'Migrate to new database system', status: 'planning', createdBy: users[1].id }
    ]);
    
    // Create tasks
    await Task.bulkCreate([
      { title: 'Design mockups', description: 'Create design mockups for homepage', status: 'pending', projectId: projects[0].id, assignedTo: users[0].id },
      { title: 'Setup authentication', description: 'Implement JWT authentication', status: 'in-progress', projectId: projects[1].id, assignedTo: users[0].id },
      { title: 'Review database schema', description: 'Review and optimize schema', status: 'completed', projectId: projects[2].id, assignedTo: users[0].id },
      { title: 'API documentation', description: 'Write API documentation', status: 'pending', projectId: projects[0].id, assignedTo: users[0].id }
    ]);
    
    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await sequelize.close();
  }
}

seed();