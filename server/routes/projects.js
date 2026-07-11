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

// Multer (incl. 2.x) uses (req, file, cb) callbacks. The storage/filter functions
// MUST invoke cb — returning or throwing leaves the upload hanging (or crashes the
// process on a non-image), so always call cb(null, value) / cb(error).
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadPath);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: FILE_UPLOAD.MAX_FILE_SIZE,
  },
  fileFilter: function (_req, file, cb) {
    // Accept any image MIME type; reject others via cb (not by throwing).
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image files are allowed!'));
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
