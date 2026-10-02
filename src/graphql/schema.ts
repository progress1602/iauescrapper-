export const typeDefs = `#graphql
  type User {
    id: ID!
    name: String!
    email: String!
    role: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Announcement {
    id: ID!
    title: String!
    content: String!
    summary: String
    category: String!
    sourceType: String!
    sourceUrl: String!
    canonicalUrl: String!
    publishedAt: String
    imageUrl: String
    sourceAttribution: String
  }

  type Course {
    id: ID!
    code: String!
    title: String!
    description: String
    units: Int
    unitsExplicitlyProvided: Boolean!
    level: Int
    sourceUrl: String!
    isActive: Boolean!
  }

  type Department {
    id: ID!
    name: String!
    code: String
    hod: String
    sourceUrl: String
  }

  type Faculty {
    id: ID!
    name: String!
    dean: String
    sourceUrl: String
    departments: [Department!]
  }

  type Resource {
    id: ID!
    title: String!
    description: String
    type: String!
    sourceUrl: String!
    fileUrl: String
    sourceType: String!
  }

  type ScraperSource {
    id: ID!
    name: String!
    baseUrl: String!
    sourceType: String!
    enabled: Boolean!
    crawlEnabled: Boolean!
    scrapeIntervalMinutes: Int!
    priority: Int!
    lastRunAt: String
    lastSuccessAt: String
    lastFailureAt: String
    lastError: String
  }

  type ScraperError {
    url: String
    message: String!
    timestamp: String
  }

  type ScraperRun {
    id: ID!
    sourceId: ID!
    status: String!
    startedAt: String!
    completedAt: String
    pagesVisited: Int!
    itemsFound: Int!
    itemsCreated: Int!
    itemsUpdated: Int!
    itemsUnchanged: Int!
    itemsRejected: Int!
    durationMs: Int!
    errors: [ScraperError!]
  }

  type ScraperChange {
    id: ID!
    sourceId: ID!
    entityType: String!
    entityId: ID
    changeType: String!
    reviewStatus: String!
    detectedAt: String!
    notes: String
  }

  type ScraperHealth {
    status: String!
    subsystemEnabled: Boolean!
    enabledSourcesCount: Int!
    disabledSourcesCount: Int!
    runningJobs: Int!
    pendingChanges: Int!
    totalItemsImported: Int!
  }

  type Query {
    me: User
    announcements(category: String, search: String, limit: Int): [Announcement!]!
    announcement(id: ID!): Announcement
    courses(level: Int, search: String, limit: Int): [Course!]!
    faculties: [Faculty!]!
    resources(type: String, limit: Int): [Resource!]!
    scraperSources: [ScraperSource!]!
    scraperRuns(limit: Int): [ScraperRun!]!
    scraperChanges(reviewStatus: String): [ScraperChange!]!
    scraperHealth: ScraperHealth!
  }

  type Mutation {
    login(email: String!, password: String!): AuthPayload!
    runScraper(sourceId: ID!): ScraperRun!
    approveChange(changeId: ID!): ScraperChange!
    ignoreChange(changeId: ID!): ScraperChange!
  }
`;
