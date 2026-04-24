const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
  requestCollaboration,
  handleCollaborationRequest,
  searchProjects,
} = require('../controllers/projectController');
const { projectValidator } = require('../middleware/validators');
const auth = require('../middleware/auth');
const { FILE_UPLOAD } = require('../config/constants');

// Configure multer for file uploads
// Use global uploadPath from server/index.js (supports Railway volumes)
const uploadPath = global.uploadPath || path.join(__dirname, '../uploads');

// Multer 2.x uses async functions instead of callbacks
const storage = multer.diskStorage({
  destination: function (_req, _file) {
    return uploadPath;
  },
  filename: function (req, file) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    return file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: FILE_UPLOAD.MAX_FILE_SIZE,
  },
  fileFilter: function (req, file) {
    // Accept any image MIME type - return true/false for multer 2.x
    if (file.mimetype.startsWith('image/')) {
      return true;
    }
    throw new Error('Only image files are allowed!');
  },
});

// @route   POST /api/projects
// @desc    Create a new project
// @access  Private
router.post('/', auth, upload.single('image'), projectValidator, createProject);

// @route   GET /api/projects
// @desc    Get all projects
// @access  Public
router.get('/', getAllProjects);

// @route   GET /api/projects/search
// @desc    Search projects
// @access  Public
router.get('/search', searchProjects);

// @route   GET /api/projects/:id
// @desc    Get project by ID
// @access  Public
router.get('/:id', getProjectById);

// @route   PUT /api/projects/:id
// @desc    Update project
// @access  Private (owner only)
router.put('/:id', auth, projectValidator, updateProject);

// @route   DELETE /api/projects/:id
// @desc    Delete project
// @access  Private (owner only)
router.delete('/:id', auth, deleteProject);

// @route   POST /api/projects/:id/collaborate
// @desc    Request to collaborate on a project
// @access  Private
router.post('/:id/collaborate', auth, requestCollaboration);

// @route   PUT /api/projects/:projectId/collaborate/:userId
// @desc    Handle collaboration request
// @access  Private (owner only)
router.put('/:projectId/collaborate/:userId', auth, handleCollaborationRequest);

module.exports = router;
