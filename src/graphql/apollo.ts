import { ApolloServer } from '@apollo/server';
import { Express, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { typeDefs } from './schema';
import { resolvers, GraphQLContext } from './resolvers';
import { UserModel, IUserDocument } from '../models/user.model';
import { env } from '../config/env';
import { AuthTokenPayload } from '../middleware/auth';

export async function setupApolloServer(app: Express): Promise<ApolloServer> {
  const apolloServer = new ApolloServer<GraphQLContext>({
    typeDefs,
    resolvers,
    introspection: true,
  });

  await apolloServer.start();

  // Embedded Apollo Sandbox Playground HTML template
  const renderApolloSandboxHTML = () => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>IAUE Student Hub Apollo Sandbox Playground</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      margin: 0;
      overflow: hidden;
      background: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    #sandbox {
      width: 100vw;
      height: 100vh;
    }
  </style>
</head>
<body>
  <div id="sandbox"></div>
  <script src="https://embeddable-sandbox.cdn.apollographql.com/_latest/embeddable-sandbox.umd.production.min.js"></script>
  <script>
    new window.EmbeddedSandbox({
      target: '#sandbox',
      initialEndpoint: window.location.origin + '/graphql',
      includeCookies: true,
      initialState: {
        document: \`# ========================================================
# 🚀 IAUE Student Hub Apollo Sandbox Playground
# ========================================================

# 1. Query Public Announcements
query GetAnnouncements {
  announcements(limit: 10) {
    id
    title
    category
    sourceUrl
    publishedAt
    summary
  }
}

# 2. Query Academic Courses with Explicit Credit Units
query GetCourses {
  courses(limit: 15) {
    id
    code
    title
    units
    unitsExplicitlyProvided
    level
    sourceUrl
  }
}

# 3. Check Scraper Subsystem Health
query CheckScraperHealth {
  scraperHealth {
    status
    subsystemEnabled
    enabledSourcesCount
    disabledSourcesCount
    runningJobs
    pendingChanges
    totalItemsImported
  }
}

# 4. List Official IAUE Scraper Sources
query GetScraperSources {
  scraperSources {
    id
    name
    baseUrl
    sourceType
    enabled
    scrapeIntervalMinutes
    lastRunAt
    lastSuccessAt
  }
}

# 5. Admin Login to retrieve Bearer Token
mutation AdminLogin {
  login(email: "admin@iauestudenthub.ng", password: "AdminSecurePassword123!") {
    token
    user {
      id
      name
      email
      role
    }
  }
}
\`
      }
    });
  </script>
</body>
</html>`;

  // Serve Embedded Apollo Sandbox UI on GET /apollo, /graphql, and /sandbox (browser navigation)
  app.get(['/apollo', '/graphql', '/sandbox'], (req: Request, res: Response, next: NextFunction) => {
    const accept = req.headers.accept || '';
    if (accept.includes('text/html') || req.path === '/apollo' || req.path === '/sandbox' || !req.query.query) {
      res.setHeader('Content-Type', 'text/html');
      res.send(renderApolloSandboxHTML());
      return;
    }
    next();
  });

  // Handle GraphQL POST requests
  app.post('/graphql', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization || (req.headers['authorization'] as string) || '';
    let user: IUserDocument | null = null;

    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        try {
          const decoded = jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
          user = await UserModel.findById(decoded.userId);
        } catch {
          // Token invalid, user remains null
        }
      }
    }

    const { query, variables, operationName } = req.body || {};

    if (!query) {
      res.status(400).json({ errors: [{ message: 'Must provide query string.' }] });
      return;
    }

    try {
      const response = await apolloServer.executeOperation(
        {
          query,
          variables,
          operationName,
        },
        {
          contextValue: { user: user || undefined },
        }
      );

      if (response.body.kind === 'single') {
        res.status(200).json(response.body.singleResult);
      } else {
        res.status(200).json(response.body);
      }
    } catch (err: unknown) {
      res.status(500).json({
        errors: [{ message: (err as Error).message || 'Internal GraphQL execution error' }],
      });
    }
  });

  return apolloServer;
}
