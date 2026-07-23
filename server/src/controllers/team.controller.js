import Team from '../models/Team.js';
import Company from '../models/Company.js';
import User from '../models/User.js';
import {
  getCompanyFilter,
  canAccessCompany,
  teamToJSON,
} from '../utils/staffPortalHelpers.js';
import {
  fetchRecruiterStudents,
  resolveApiCompanyName,
} from '../services/nexusStudentApi.service.js';

export async function listTeams(req, res) {
  try {
    const filter = getCompanyFilter(req.user, req.query.companyId);
    const teams = await Team.find(filter).populate('companyId', 'name').sort({ createdAt: -1 });
    return res.json({ teams: teams.map(teamToJSON) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list teams' });
  }
}

export async function getTeam(req, res) {
  try {
    const team = await Team.findById(req.params.id).populate('companyId', 'name');
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!canAccessCompany(req.user, team.companyId._id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    return res.json({ team: teamToJSON(team) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get team' });
  }
}

export async function createTeam(req, res) {
  try {
    if (!req.user.isCompanyAdmin && !req.user.isPlatformAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { teamName, teamLeadName, teamLeadPhone, teamLeadEmail, teamLeadUserId, members, companyId } = req.body;
    if (!teamName || !teamLeadName) {
      return res.status(400).json({ error: 'Team name and lead name are required' });
    }

    let targetCompanyId = req.user.companyId._id;
    if (req.user.isPlatformAdmin && companyId) targetCompanyId = companyId;

    const company = await Company.findById(targetCompanyId);
    if (!company) return res.status(400).json({ error: 'Invalid company' });

    const team = await Team.create({
      teamName,
      teamLeadName,
      teamLeadPhone: teamLeadPhone || '',
      teamLeadEmail: teamLeadEmail || '',
      teamLeadUserId: teamLeadUserId || null,
      members: members || [],
      companyId: company._id,
      createdBy: req.user._id,
    });

    const populated = await Team.findById(team._id).populate('companyId', 'name');
    return res.status(201).json({ team: teamToJSON(populated) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create team' });
  }
}

export async function updateTeam(req, res) {
  try {
    if (!req.user.isCompanyAdmin && !req.user.isPlatformAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!canAccessCompany(req.user, team.companyId)) return res.status(403).json({ error: 'Access denied' });

    const fields = ['teamName', 'teamLeadName', 'teamLeadPhone', 'teamLeadEmail', 'teamLeadUserId', 'members'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) team[f] = req.body[f];
    });

    await team.save();
    const populated = await Team.findById(team._id).populate('companyId', 'name');
    return res.json({ team: teamToJSON(populated) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update team' });
  }
}

export async function getMyTeam(req, res) {
  try {
    const teams = await Team.find({
      companyId: req.user.companyId._id,
      $or: [
        { teamLeadUserId: req.user._id },
        { teamLeadEmail: req.user.email },
      ],
    }).populate('companyId', 'name');

    return res.json({ teams: teams.map(teamToJSON) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get my teams' });
  }
}

export async function getTeamMemberStudents(req, res) {
  try {
    const { username } = req.params;
    const company = await Company.findById(req.user.companyId._id);
    const apiName = resolveApiCompanyName(company);
    const students = await fetchRecruiterStudents(username);
    return res.json({ students, company: apiName });
  } catch (err) {
    console.error('Team students error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch students' });
  }
}

export async function searchCompanyUsers(req, res) {
  try {
    let companyId = req.user.companyId._id;
    if (req.user.isPlatformAdmin && req.query.companyId) companyId = req.query.companyId;

    const users = await User.find({ companyId, isActive: true }).select('name email phone');
    return res.json({
      users: users.map((u) => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        phone: u.phone,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to search users' });
  }
}
