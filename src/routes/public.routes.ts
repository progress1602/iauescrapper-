import { Router, Request, Response } from 'express';
import { AnnouncementModel } from '../models/announcement.model';
import { CourseModel, FacultyModel, DepartmentModel } from '../models/academic.model';
import { ResourceModel } from '../models/resource.model';
import { sendSuccess, sendError } from '../utils/response';

export const publicRoutes = Router();

/**
 * GET /api/v1/announcements
 * Public announcements with search, category filtering, and source attribution.
 */
publicRoutes.get('/announcements', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { status: 'published' };
    if (req.query.category) {
      filter.category = req.query.category;
    }
    if (req.query.q) {
      filter.$text = { $search: req.query.q as string };
    }

    const [items, total] = await Promise.all([
      AnnouncementModel.find(filter)
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AnnouncementModel.countDocuments(filter),
    ]);

    sendSuccess(res, 'Announcements retrieved successfully', items, 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      disclaimer:
        'IAUE Student Hub is an independent academic resource platform and is not officially operated or endorsed by Ignatius Ajuru University of Education. All items retain links to their original official IAUE sources.',
    });
  } catch (err) {
    sendError(res, (err as Error).message, 500, 'FETCH_ANNOUNCEMENTS_FAILED');
  }
});

/**
 * GET /api/v1/announcements/:id
 */
publicRoutes.get('/announcements/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const item = await AnnouncementModel.findById(req.params.id);
    if (!item) {
      sendError(res, 'Announcement not found', 404, 'NOT_FOUND');
      return;
    }
    sendSuccess(res, 'Announcement retrieved successfully', item);
  } catch (err) {
    sendError(res, (err as Error).message, 500, 'FETCH_ANNOUNCEMENT_FAILED');
  }
});

/**
 * GET /api/v1/courses
 * Public courses with explicit units transparency.
 */
publicRoutes.get('/courses', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { isActive: true };
    if (req.query.level) {
      filter.level = parseInt(req.query.level as string, 10);
    }
    if (req.query.q) {
      filter.$or = [
        { code: { $regex: req.query.q as string, $options: 'i' } },
        { title: { $regex: req.query.q as string, $options: 'i' } },
      ];
    }

    const [courses, total] = await Promise.all([
      CourseModel.find(filter)
        .sort({ code: 1 })
        .skip(skip)
        .limit(limit)
        .populate('departmentId', 'name')
        .populate('facultyId', 'name')
        .lean(),
      CourseModel.countDocuments(filter),
    ]);

    sendSuccess(res, 'Courses retrieved successfully', courses, 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      note: 'Credit units are shown strictly when officially published in IAUE sources. Courses with unconfirmed units display null.',
    });
  } catch (err) {
    sendError(res, (err as Error).message, 500, 'FETCH_COURSES_FAILED');
  }
});

/**
 * GET /api/v1/faculties
 */
publicRoutes.get('/faculties', async (_req: Request, res: Response): Promise<void> => {
  try {
    const faculties = await FacultyModel.find({ isActive: true }).lean();
    const facultyIds = faculties.map((f) => f._id);
    const departments = await DepartmentModel.find({
      facultyId: { $in: facultyIds },
      isActive: true,
    }).lean();

    const data = faculties.map((faculty) => ({
      ...faculty,
      departments: departments.filter(
        (d) => d.facultyId.toString() === faculty._id.toString()
      ),
    }));

    sendSuccess(res, 'Faculties and departments retrieved successfully', data);
  } catch (err) {
    sendError(res, (err as Error).message, 500, 'FETCH_FACULTIES_FAILED');
  }
});

/**
 * GET /api/v1/resources
 * Public OER and official academic documents.
 */
publicRoutes.get('/resources', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 30, 100);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { status: 'active' };
    if (req.query.type) {
      filter.type = req.query.type;
    }

    const [resources, total] = await Promise.all([
      ResourceModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('courseId', 'code title')
        .lean(),
      ResourceModel.countDocuments(filter),
    ]);

    sendSuccess(res, 'Resources retrieved successfully', resources, 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    sendError(res, (err as Error).message, 500, 'FETCH_RESOURCES_FAILED');
  }
});

export default publicRoutes;
