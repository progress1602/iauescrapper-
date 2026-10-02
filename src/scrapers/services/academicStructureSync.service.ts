import { Types } from 'mongoose';
import {
  UniversityModel,
  FacultyModel,
  DepartmentModel,
  ProgrammeModel,
  IFacultyDocument,
  IDepartmentDocument,
} from '../../models/academic.model';
import { ParsedFaculty, ParsedProgramme } from '../core/scraper.types';
import { ScraperLogger } from '../core/scraper.logger';

const logger = new ScraperLogger('AcademicStructureSyncService');

export class AcademicStructureSyncService {
  private defaultUniversityId: Types.ObjectId | null = null;

  public async getUniversityId(): Promise<Types.ObjectId> {
    if (this.defaultUniversityId) return this.defaultUniversityId;
    let uni = await UniversityModel.findOne({ acronym: 'IAUE' });
    if (!uni) {
      uni = await UniversityModel.create({
        name: 'Ignatius Ajuru University of Education',
        acronym: 'IAUE',
        website: 'https://iaue.edu.ng',
      });
    }
    this.defaultUniversityId = uni._id as Types.ObjectId;
    return this.defaultUniversityId;
  }

  /**
   * Synchronizes faculties and their listed departments.
   */
  public async syncFaculties(
    faculties: ParsedFaculty[]
  ): Promise<{ created: number; updated: number; unchanged: number }> {
    const universityId = await this.getUniversityId();
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const item of faculties) {
      if (!item.name || !item.sourceUrl) continue;

      try {
        let faculty = await FacultyModel.findOne({
          universityId,
          name: { $regex: new RegExp(`^${item.name.trim()}$`, 'i') },
        });

        if (!faculty) {
          faculty = await FacultyModel.create({
            universityId,
            name: item.name.trim(),
            code: item.code,
            dean: item.dean,
            sourceUrl: item.sourceUrl,
            isActive: true,
          });
          created++;
        } else {
          let hasChange = false;
          if (item.dean && faculty.dean !== item.dean) {
            faculty.dean = item.dean;
            hasChange = true;
          }
          if (hasChange) {
            await faculty.save();
            updated++;
          } else {
            unchanged++;
          }
        }

        // Sync listed departments under this faculty
        if (faculty) {
          for (const deptName of item.departments) {
            await this.syncDepartment(
              universityId,
              faculty._id as Types.ObjectId,
              deptName,
              item.sourceUrl
            );
          }
        }
      } catch (err) {
        logger.error(`Error syncing faculty '${item.name}': ${(err as Error).message}`);
      }
    }

    return { created, updated, unchanged };
  }

  /**
   * Synchronizes a department under a faculty.
   */
  public async syncDepartment(
    universityId: Types.ObjectId,
    facultyId: Types.ObjectId,
    departmentName: string,
    sourceUrl: string,
    hod?: string
  ): Promise<IDepartmentDocument> {
    const cleanName = departmentName.trim();
    let dept = await DepartmentModel.findOne({
      facultyId,
      name: { $regex: new RegExp(`^${cleanName}$`, 'i') },
    });

    if (!dept) {
      dept = await DepartmentModel.create({
        universityId,
        facultyId,
        name: cleanName,
        sourceUrl,
        hod,
        isActive: true,
      });
    } else if (hod && dept.hod !== hod) {
      dept.hod = hod;
      await dept.save();
    }

    return dept;
  }

  /**
   * Synchronizes academic programmes, linking them to valid departments.
   */
  public async syncProgrammes(
    programmes: ParsedProgramme[]
  ): Promise<{ created: number; updated: number; unchanged: number }> {
    const universityId = await this.getUniversityId();
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const prog of programmes) {
      if (!prog.name || !prog.sourceUrl) continue;

      try {
        // Resolve or create Faculty & Department
        let faculty: IFacultyDocument | null = null;
        if (prog.facultyName) {
          faculty = await FacultyModel.findOne({
            universityId,
            name: { $regex: new RegExp(`^${prog.facultyName.trim()}$`, 'i') },
          });
          if (!faculty) {
            faculty = await FacultyModel.create({
              universityId,
              name: prog.facultyName.trim(),
              sourceUrl: prog.sourceUrl,
              isActive: true,
            });
          }
        } else {
          faculty = await FacultyModel.findOne({ universityId });
        }

        let department: IDepartmentDocument | null = null;
        if (faculty && prog.departmentName) {
          department = await this.syncDepartment(
            universityId,
            faculty._id as Types.ObjectId,
            prog.departmentName,
            prog.sourceUrl
          );
        } else if (faculty) {
          // Fallback to general department under this faculty
          department = await this.syncDepartment(
            universityId,
            faculty._id as Types.ObjectId,
            'General Studies',
            prog.sourceUrl
          );
        }

        if (!department || !faculty) continue;

        const session = prog.sessionId || '2025/2026';

        // Check for existing programme in this department & session
        const existing = await ProgrammeModel.findOne({
          departmentId: department._id,
          name: { $regex: new RegExp(`^${prog.name.trim()}$`, 'i') },
          sessionId: session,
        });

        if (!existing) {
          await ProgrammeModel.create({
            universityId,
            facultyId: faculty._id,
            departmentId: department._id,
            name: prog.name.trim(),
            degreeType: prog.degreeType,
            sessionId: session,
            sourceUrl: prog.sourceUrl,
            isActive: true,
          });
          created++;
        } else {
          unchanged++;
        }
      } catch (err) {
        logger.error(`Error syncing programme '${prog.name}': ${(err as Error).message}`);
      }
    }

    return { created, updated, unchanged };
  }
}

export const academicStructureSyncService = new AcademicStructureSyncService();
