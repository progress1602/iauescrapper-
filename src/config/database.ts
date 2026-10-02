import mongoose from 'mongoose';
import { env } from './env';
import { UserModel } from '../models/user.model';
import { UniversityModel } from '../models/academic.model';
import { ScraperSourceModel } from '../scrapers/models/scraperSource.model';
import { INITIAL_IAUE_SOURCES } from '../scrapers/config/iaueSources';

let mongod: { stop: () => Promise<boolean> } | null = null;

async function seedInitialData(): Promise<void> {
  try {
    // 1. Seed Default Admin User
    const existingAdmin = await UserModel.findOne({ email: env.ADMIN_EMAIL.toLowerCase() });
    if (!existingAdmin) {
      await UserModel.create({
        name: 'IAUE Student Hub Administrator',
        email: env.ADMIN_EMAIL.toLowerCase(),
        password: env.ADMIN_PASSWORD,
        role: 'admin',
        isActive: true,
      });
      console.log(`[Seed] Default administrator account created for ${env.ADMIN_EMAIL}`);
    }

    // 2. Seed Default University
    const existingUni = await UniversityModel.findOne({ acronym: 'IAUE' });
    if (!existingUni) {
      await UniversityModel.create({
        name: 'Ignatius Ajuru University of Education',
        acronym: 'IAUE',
        website: 'https://iaue.edu.ng',
        logoUrl: 'https://iaue.edu.ng/wp-content/uploads/2021/04/iaue-logo.png',
      });
      console.log('[Seed] Default university IAUE initialized.');
    }

    // 3. Seed Initial IAUE Scraper Sources
    const sourceCount = await ScraperSourceModel.countDocuments();
    if (sourceCount === 0) {
      for (const src of INITIAL_IAUE_SOURCES) {
        await ScraperSourceModel.create(src);
      }
      console.log(`[Seed] Seeded ${INITIAL_IAUE_SOURCES.length} official IAUE scraper sources.`);
    }
  } catch (seedErr) {
    console.warn(`[Seed] Warning during initial data seed: ${(seedErr as Error).message}`);
  }
}

export async function connectDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  const mongoUri = env.MONGODB_URI;
  const isProduction = env.NODE_ENV === 'production';

  if (!mongoUri) {
    if (isProduction) {
      throw new Error(
        'FATAL: MONGODB_URI environment variable is required in production mode.'
      );
    }

    // Try connecting to a local MongoDB instance first, fallback to in-memory
    try {
      await mongoose.connect('mongodb://127.0.0.1:27017/iaue-student-hub', {
        serverSelectionTimeoutMS: 2000,
        family: 4,
      });
      console.log('Connected to local MongoDB at mongodb://127.0.0.1:27017/iaue-student-hub');
    } catch {
      console.log('Local MongoDB not reachable. Starting isolated MongoMemoryServer for development...');
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const memoryServer = await MongoMemoryServer.create();
      mongod = memoryServer;
      const memUri = memoryServer.getUri();
      await mongoose.connect(memUri);
      console.log(`Connected to in-memory MongoDB at ${memUri}`);
    }
  } else {
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 30000,
        family: 4,
      });
      console.log('Successfully connected to MongoDB cluster.');
    } catch (err) {
      console.error('Failed to connect to configured MONGODB_URI:', err);
      throw err;
    }
  }

  // Seed default admin, university, and sources
  await seedInitialData();

  return mongoose;
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
  console.log('Database disconnected cleanly.');
}
