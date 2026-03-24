const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
require('dotenv').config();

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '..', process.env.DB_NAME || 'task_management.db'),
  logging: false
});

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'employee',
    validate: {
      isIn: [['employee', 'manager', 'admin']]
    }
  }
});

const Project = sequelize.define('Project', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'active'
  }
});

const Task = sequelize.define('Task', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending'
  }
});

// Associations
User.hasMany(Project, { as: 'createdProjects', foreignKey: 'createdBy' });
Project.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });

User.hasMany(Task, { as: 'assignedTasks', foreignKey: 'assignedTo' });
Task.belongsTo(User, { as: 'assignee', foreignKey: 'assignedTo' });

Project.hasMany(Task, { foreignKey: 'projectId' });
Task.belongsTo(Project, { foreignKey: 'projectId' });

module.exports = { sequelize, User, Project, Task };