const User = require('../models/User');
const Resume = require('../models/Resume');
const Template = require('../models/Template');
const KeywordLibrary = require('../models/KeywordLibrary');
const ATSReport = require('../models/ATSReport');

const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const query = search ? { $or: [
      { name: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') }
    ]} : {};

    const users = await User.find(query)
      .select('-passwordHash')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    // Get resume count for each user
    const usersWithResumeCount = await Promise.all(
      users.map(async (user) => {
        const resumeCount = await Resume.countDocuments({ userId: user._id });
        return {
          _id: user._id,
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role || 'USER',
          resumes: resumeCount,
          createdAt: user.createdAt,
          isActive: user.isActive
        };
      })
    );

    const count = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        users: usersWithResumeCount,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count
      }
    });
  } catch (error) {
    console.error('Get Users Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

const getAllResumes = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const [resumes, total] = await Promise.all([
      Resume.find({})
        .populate('userId', 'name email')
        .select('resumeTitle createdAt updatedAt downloadCount userId jdId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit * 1)
        .lean(),
      Resume.countDocuments({})
    ]);

    res.status(200).json({
      success: true,
      data: {
        resumes,
        total,
        page: page * 1,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get All Resumes Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch resumes' });
  }
};

const getStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalResumes = await Resume.countDocuments();
    
    // Get total downloads
    const totalDownloads = await Resume.aggregate([
      { $group: { _id: null, total: { $sum: '$downloadCount' } } }
    ]);

    // Get ATS score statistics
    const atsStats = await Resume.aggregate([
      {
        $group: {
          _id: null,
          avgATSScore: { $avg: '$atsScore' },
          highScore: {
            $sum: { $cond: [{ $gte: ['$atsScore', 80] }, 1, 0] }
          }
        }
      }
    ]);

    // Get monthly resume creation trend (last 12 months)
    const monthlyTrend = await Resume.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      },
      {
        $project: {
          _id: 0,
          month: {
            $dateToString: {
              format: '%b',
              date: {
                $dateFromParts: { year: '$_id.year', month: '$_id.month', day: 1 }
              }
            }
          },
          resumes: '$count'
        }
      }
    ]);

    // Get ATS score distribution (0-20, 21-40, 41-60, 61-80, 81-100)
    const atsScoreDistribution = await Resume.aggregate([
      {
        $facet: {
          range0_20: [
            { $match: { atsScore: { $gte: 0, $lte: 20 } } },
            { $count: 'count' }
          ],
          range21_40: [
            { $match: { atsScore: { $gt: 20, $lte: 40 } } },
            { $count: 'count' }
          ],
          range41_60: [
            { $match: { atsScore: { $gt: 40, $lte: 60 } } },
            { $count: 'count' }
          ],
          range61_80: [
            { $match: { atsScore: { $gt: 60, $lte: 80 } } },
            { $count: 'count' }
          ],
          range81_100: [
            { $match: { atsScore: { $gt: 80, $lte: 100 } } },
            { $count: 'count' }
          ]
        }
      }
    ]);

    // Format ATS score distribution
    const scoreDistribution = [
      { range: '0-20', count: atsScoreDistribution[0]?.range0_20?.[0]?.count || 0, color: '#ef4444' },
      { range: '21-40', count: atsScoreDistribution[0]?.range21_40?.[0]?.count || 0, color: '#f97316' },
      { range: '41-60', count: atsScoreDistribution[0]?.range41_60?.[0]?.count || 0, color: '#eab308' },
      { range: '61-80', count: atsScoreDistribution[0]?.range61_80?.[0]?.count || 0, color: '#84cc16' },
      { range: '81-100', count: atsScoreDistribution[0]?.range81_100?.[0]?.count || 0, color: '#10b981' }
    ];

    // Get template usage distribution
    const templateUsageData = await Resume.aggregate([
      {
        $group: {
          _id: '$templateId',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          name: {
            $switch: {
              branches: [
                { case: { $eq: ['$_id', 'classic'] }, then: 'Classic Professional' },
                { case: { $eq: ['$_id', 'fresher'] }, then: 'Fresher Clean' },
                { case: { $eq: ['$_id', 'tech'] }, then: 'Experienced Tech' }
              ],
              default: '$_id'
            }
          },
          value: '$count'
        }
      }
    ]);

    // Add colors to template usage
    const templateUsage = templateUsageData.map((item, index) => ({
      ...item,
      color: ['#4f46e5', '#10b981', '#f59e0b'][index % 3]
    }));

    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5).select('-passwordHash');
    const recentResumes = await Resume.find().sort({ createdAt: -1 }).limit(5).populate('userId', 'name email');

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalResumes,
          totalDownloads: totalDownloads[0]?.total || 0,
          activeUsers: await User.countDocuments({ isActive: true }),
          avgATSScore: atsStats[0]?.avgATSScore ? Math.round(atsStats[0].avgATSScore * 10) / 10 : 0,
          highScore: atsStats[0]?.highScore || 0
        },
        charts: {
          monthlyTrend,
          atsScoreDistribution: scoreDistribution,
          templateUsage
        },
        recentUsers,
        recentResumes
      }
    });
  } catch (error) {
    console.error('Get Stats Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
};

const createTemplate = async (req, res) => {
  try {
    const payload = { ...(req.body || {}) };
    payload.layoutConfig = payload.layoutConfig || {};
    payload.layoutConfig.columns = 1;
    payload.layoutConfig.features = {
      ...(payload.layoutConfig.features || {}),
      showIcons: false,
      showPhoto: false
    };
    const template = new Template({ ...payload, createdBy: req.user._id });
    await template.save();
    res.status(201).json({ success: true, message: 'Template created', data: { template } });
  } catch (error) {
    console.error('Create Template Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create template' });
  }
};

const updateTemplate = async (req, res) => {
  try {
    const payload = { ...(req.body || {}) };
    payload.layoutConfig = payload.layoutConfig || {};
    payload.layoutConfig.columns = 1;
    payload.layoutConfig.features = {
      ...(payload.layoutConfig.features || {}),
      showIcons: false,
      showPhoto: false
    };
    const template = await Template.findByIdAndUpdate(
      req.params.id,
      { $set: payload },
      { new: true, runValidators: true }
    );
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    res.status(200).json({ success: true, message: 'Template updated', data: { template } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update template' });
  }
};

const getAllTemplates = async (req, res) => {
  try {
    const templates = await Template.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: { templates, count: templates.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch templates' });
  }
};

const getKeywordLibraries = async (req, res) => {
  try {
    const libraries = await KeywordLibrary.find({ isActive: true }).sort({ role: 1 });
    res.status(200).json({ success: true, data: { libraries, count: libraries.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch keyword libraries' });
  }
};

const addKeywordLibrary = async (req, res) => {
  try {
    const library = new KeywordLibrary({ ...req.body, updatedBy: req.user._id });
    await library.save();
    res.status(201).json({ success: true, message: 'Keyword library created', data: { library } });
  } catch (error) {
    console.error('Add Keyword Library Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create keyword library' });
  }
};

const updateKeywordLibrary = async (req, res) => {
  try {
    const library = await KeywordLibrary.findByIdAndUpdate(
      req.params.id,
      { $set: { ...req.body, lastUpdated: Date.now(), updatedBy: req.user._id } },
      { new: true, runValidators: true }
    );
    if (!library) {
      return res.status(404).json({ success: false, message: 'Keyword library not found' });
    }
    res.status(200).json({ success: true, message: 'Keyword library updated', data: { library } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update keyword library' });
  }
};

const getSuggestionRules = async (req, res) => {
  try {
    const libraries = await KeywordLibrary.find({ isActive: true }).sort({ role: 1 });
    const rules = libraries.map((lib) => ({
      _id: lib._id,
      role: lib.role,
      suggestionRules: lib.commonPhrases || [],
      actionVerbs: lib.actionVerbs || []
    }));
    res.status(200).json({ success: true, data: { rules, count: rules.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch suggestion rules' });
  }
};

const updateSuggestionRules = async (req, res) => {
  try {
    const { suggestionRules, actionVerbs } = req.body || {};
    const update = {};
    if (Array.isArray(suggestionRules)) update.commonPhrases = suggestionRules;
    if (Array.isArray(actionVerbs)) update.actionVerbs = actionVerbs;
    const library = await KeywordLibrary.findByIdAndUpdate(
      req.params.id,
      { $set: { ...update, lastUpdated: Date.now(), updatedBy: req.user._id } },
      { new: true, runValidators: true }
    );
    if (!library) return res.status(404).json({ success: false, message: 'Keyword library not found' });
    res.status(200).json({
      success: true,
      message: 'Suggestion rules updated',
      data: {
        rule: {
          _id: library._id,
          role: library.role,
          suggestionRules: library.commonPhrases || [],
          actionVerbs: library.actionVerbs || []
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update suggestion rules' });
  }
};

// Add new role to keyword library
const addRoleKeywordLibrary = async (req, res) => {
  try {
    const { role } = req.body;
    if (!role || typeof role !== 'string') {
      return res.status(400).json({ success: false, message: 'Role is required' });
    }

    // Check if role already exists
    const existing = await KeywordLibrary.findOne({ role: role.trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Role already exists' });
    }

    const library = new KeywordLibrary({
      role: role.trim(),
      keywords: [],
      actionVerbs: [],
      commonPhrases: [],
      industryTerms: [],
      isActive: true,
      updatedBy: req.user._id
    });
    
    await library.save();
    res.status(201).json({ 
      success: true, 
      message: 'Role created successfully',
      data: { library } 
    });
  } catch (error) {
    console.error('Add Role Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create role' });
  }
};

// Delete role from keyword library
const deleteRoleKeywordLibrary = async (req, res) => {
  try {
    const { role } = req.params;
    if (!role) {
      return res.status(400).json({ success: false, message: 'Role is required' });
    }

    const library = await KeywordLibrary.findOneAndDelete({ role: decodeURIComponent(role) });
    if (!library) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Role deleted successfully' 
    });
  } catch (error) {
    console.error('Delete Role Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete role' });
  }
};

// Add keyword to existing role
const addKeywordToRole = async (req, res) => {
  try {
    const { role, keyword } = req.body;
    if (!role || !keyword) {
      return res.status(400).json({ success: false, message: 'Role and keyword are required' });
    }

    const library = await KeywordLibrary.findOne({ role });
    if (!library) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    // Check if keyword already exists in the keywords array
    const keywordTerm = keyword.trim();
    const keywordExists = library.keywords.some(k => k.term.toLowerCase() === keywordTerm.toLowerCase());
    
    if (!keywordExists) {
      // Add keyword with default category 'skill' and weight 1
      library.keywords.push({
        term: keywordTerm,
        category: 'skill',
        weight: 1,
        aliases: []
      });
      library.lastUpdated = Date.now();
      library.updatedBy = req.user._id;
      await library.save();
    }

    res.status(200).json({ 
      success: true, 
      message: 'Keyword added successfully',
      data: { library } 
    });
  } catch (error) {
    console.error('Add Keyword Error:', error);
    res.status(500).json({ success: false, message: 'Failed to add keyword' });
  }
};

// Remove keyword from role
const removeKeywordFromRole = async (req, res) => {
  try {
    const { role, keyword } = req.body;
    if (!role || !keyword) {
      return res.status(400).json({ success: false, message: 'Role and keyword are required' });
    }

    const library = await KeywordLibrary.findOne({ role });
    if (!library) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    // Remove from keywords array by filtering out the keyword term
    const keywordTerm = keyword.trim().toLowerCase();
    library.keywords = library.keywords.filter(k => 
      k.term && k.term.toLowerCase() !== keywordTerm
    );
    
    library.lastUpdated = Date.now();
    library.updatedBy = req.user._id;
    await library.save();

    res.status(200).json({ 
      success: true, 
      message: 'Keyword removed successfully',
      data: { library } 
    });
  } catch (error) {
    console.error('Remove Keyword Error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove keyword' });
  }
};

// Get recent activity from database
const getActivity = async (req, res) => {
  try {
    const limit = req.query.limit || 10;
    const activities = [];

    // Fetch recent resumes created
    const recentResumes = await Resume.find()
      .populate('userId', 'name')
      .select('resumeTitle userId createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    recentResumes.forEach((resume) => {
      activities.push({
        user: resume.userId?.name || 'Unknown User',
        action: 'Created resume',
        time: resume.createdAt,
        timestamp: resume.createdAt
      });
    });

    // Fetch recent resume downloads (using downloadCount change)
    const recentDownloads = await Resume.find({ downloadCount: { $gt: 0 } })
      .populate('userId', 'name')
      .select('resumeTitle userId updatedAt downloadCount')
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();

    recentDownloads.forEach((resume) => {
      activities.push({
        user: resume.userId?.name || 'Unknown User',
        action: 'Downloaded resume',
        time: resume.updatedAt,
        timestamp: resume.updatedAt
      });
    });

    // Fetch recent ATS score activities
    const recentATS = await ATSReport.find()
      .populate('userId', 'name')
      .select('userId createdAt totalScore')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    recentATS.forEach((report) => {
      activities.push({
        user: report.userId?.name || 'Unknown User',
        action: 'Checked ATS score',
        time: report.createdAt,
        timestamp: report.createdAt
      });
    });

    // Fetch recent user signups
    const recentUsers = await User.find()
      .select('name createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    recentUsers.forEach((user) => {
      activities.push({
        user: user.name,
        action: 'Created account',
        time: user.createdAt,
        timestamp: user.createdAt
      });
    });

    // Sort by timestamp and limit to requested count
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const limitedActivities = activities.slice(0, limit);

    res.status(200).json({
      success: true,
      data: {
        activities: limitedActivities,
        count: limitedActivities.length
      }
    });
  } catch (error) {
    console.error('Get Activity Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch activity' });
  }
};

module.exports = {
  getAllUsers,
  getAllResumes,
  getStats,
  createTemplate,
  updateTemplate,
  getAllTemplates,
  getKeywordLibraries,
  addKeywordLibrary,
  updateKeywordLibrary,
  getSuggestionRules,
  updateSuggestionRules,
  addRoleKeywordLibrary,
  deleteRoleKeywordLibrary,
  addKeywordToRole,
  removeKeywordFromRole,
  getActivity
};
