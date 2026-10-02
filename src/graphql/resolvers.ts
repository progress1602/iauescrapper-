import { Types } from 'mongoose';
import { UserModel, IUserDocument } from '../models/user.model';
import { AnnouncementModel } from '../models/announcement.model';
import { CourseModel, FacultyModel, DepartmentModel } from '../models/academic.model';
import { ResourceModel } from '../models/resource.model';
import { ScraperSourceModel } from '../scrapers/models/scraperSource.model';
import { ScraperRunModel } from '../scrapers/models/scraperRun.model';
import { ScraperChangeModel } from '../scrapers/models/scraperChange.model';
import { ScraperItemModel } from '../scrapers/models/scraperItem.model';
import { generateToken } from '../middleware/auth';
import { scraperRunService } from '../scrapers/services/scraperRun.service';
import { scraperChangeDetectionService } from '../scrapers/services/scraperChangeDetection.service';
import { env } from '../config/env';

export interface GraphQLContext {
  user?: IUserDocument;
}

export const resolvers = {
  Query: {
    me: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      return context.user || null;
    },

    announcements: async (
      _parent: unknown,
      args: { category?: string; search?: string; limit?: number }
    ) => {
      const filter: Record<string, unknown> = { status: 'published' };
      if (args.category) filter.category = args.category;
      if (args.search) filter.$text = { $search: args.search };

      const limit = Math.min(args.limit || 30, 100);
      return AnnouncementModel.find(filter).sort({ publishedAt: -1 }).limit(limit).lean();
    },

    announcement: async (_parent: unknown, args: { id: string }) => {
      return AnnouncementModel.findById(args.id).lean();
    },

    courses: async (
      _parent: unknown,
      args: { level?: number; search?: string; limit?: number }
    ) => {
      const filter: Record<string, unknown> = { isActive: true };
      if (args.level) filter.level = args.level;
      if (args.search) {
        filter.$or = [
          { code: { $regex: args.search, $options: 'i' } },
          { title: { $regex: args.search, $options: 'i' } },
        ];
      }

      const limit = Math.min(args.limit || 50, 100);
      return CourseModel.find(filter).sort({ code: 1 }).limit(limit).lean();
    },

    faculties: async () => {
      const faculties = await FacultyModel.find({ isActive: true }).lean();
      const facultyIds = faculties.map((f) => f._id);
      const departments = await DepartmentModel.find({
        facultyId: { $in: facultyIds },
        isActive: true,
      }).lean();

      return faculties.map((faculty) => ({
        ...faculty,
        id: faculty._id,
        departments: departments
          .filter((d) => d.facultyId.toString() === faculty._id.toString())
          .map((d) => ({ ...d, id: d._id })),
      }));
    },

    resources: async (_parent: unknown, args: { type?: string; limit?: number }) => {
      const filter: Record<string, unknown> = { status: 'active' };
      if (args.type) filter.type = args.type;
      const limit = Math.min(args.limit || 30, 100);
      return ResourceModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    },

    scraperSources: async () => {
      return ScraperSourceModel.find().sort({ priority: 1, name: 1 }).lean();
    },

    scraperRuns: async (_parent: unknown, args: { limit?: number }) => {
      const limit = Math.min(args.limit || 20, 100);
      const runs = await ScraperRunModel.find().sort({ startedAt: -1 }).limit(limit).lean();
      return runs.map((r) => ({
        ...r,
        id: r._id,
        errors: r.runErrors,
      }));
    },

    scraperChanges: async (_parent: unknown, args: { reviewStatus?: string }) => {
      const filter: Record<string, unknown> = {};
      if (args.reviewStatus) filter.reviewStatus = args.reviewStatus;
      return ScraperChangeModel.find(filter).sort({ detectedAt: -1 }).lean();
    },

    scraperHealth: async () => {
      const [sources, runningJobs, pendingChanges, totalItems, lastFailedRun] =
        await Promise.all([
          ScraperSourceModel.find().lean(),
          ScraperRunModel.countDocuments({ status: 'running' }),
          ScraperChangeModel.countDocuments({ reviewStatus: 'pending' }),
          ScraperItemModel.countDocuments({ status: 'active' }),
          ScraperRunModel.findOne({ status: 'failed' }).sort({ completedAt: -1 }).lean(),
        ]);

      const enabledSources = sources.filter((s) => s.enabled);
      const disabledSources = sources.filter((s) => !s.enabled);
      const totalErrors = sources.filter((s) => !!s.lastError).length;

      let status = 'healthy';
      if (!env.SCRAPER_ENABLED) status = 'disabled';
      else if (totalErrors > 0 || lastFailedRun) status = 'degraded';

      return {
        status,
        subsystemEnabled: env.SCRAPER_ENABLED,
        enabledSourcesCount: enabledSources.length,
        disabledSourcesCount: disabledSources.length,
        runningJobs,
        pendingChanges,
        totalItemsImported: totalItems,
      };
    },
  },

  Mutation: {
    login: async (
      _parent: unknown,
      args: { email: string; password: string }
    ) => {
      const user = await UserModel.findOne({ email: args.email.toLowerCase().trim() });
      if (!user) {
        throw new Error('Invalid email or password');
      }

      const match = await user.comparePassword(args.password);
      if (!match) {
        throw new Error('Invalid email or password');
      }

      if (!user.isActive) {
        throw new Error('User account is deactivated');
      }

      const token = generateToken({
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      return {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      };
    },

    runScraper: async (
      _parent: unknown,
      args: { sourceId: string },
      context: GraphQLContext
    ) => {
      if (!context.user || context.user.role !== 'admin') {
        throw new Error('Forbidden: Administrator privileges required to run scrapers.');
      }

      const run = await scraperRunService.executeRun(args.sourceId, 'manual');
      return {
        ...run.toObject(),
        id: run._id,
        errors: run.runErrors,
      };
    },

    approveChange: async (
      _parent: unknown,
      args: { changeId: string },
      context: GraphQLContext
    ) => {
      if (!context.user || context.user.role !== 'admin') {
        throw new Error('Forbidden: Administrator privileges required to approve changes.');
      }

      const approved = await scraperChangeDetectionService.approveChange(
        args.changeId,
        context.user._id as Types.ObjectId
      );
      if (!approved) throw new Error('Change record not found');
      return approved;
    },

    ignoreChange: async (
      _parent: unknown,
      args: { changeId: string },
      context: GraphQLContext
    ) => {
      if (!context.user || context.user.role !== 'admin') {
        throw new Error('Forbidden: Administrator privileges required to ignore changes.');
      }

      const ignored = await scraperChangeDetectionService.ignoreChange(
        args.changeId,
        context.user._id as Types.ObjectId
      );
      if (!ignored) throw new Error('Change record not found');
      return ignored;
    },
  },
};
