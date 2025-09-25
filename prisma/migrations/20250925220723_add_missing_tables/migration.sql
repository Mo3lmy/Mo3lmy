/*
  Warnings:

  - Added the required column `description` to the `UserAchievement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `UserAchievement` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN "emotionalContext" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN "wasHelpful" BOOLEAN;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN "difficultyVariations" TEXT;
ALTER TABLE "Lesson" ADD COLUMN "emotionalTones" TEXT;
ALTER TABLE "Lesson" ADD COLUMN "motivationalMessages" TEXT;

-- AlterTable
ALTER TABLE "Progress" ADD COLUMN "emotionalJourney" TEXT;
ALTER TABLE "Progress" ADD COLUMN "masteredSections" TEXT;
ALTER TABLE "Progress" ADD COLUMN "struggledSections" TEXT;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN "encouragementMessages" TEXT;
ALTER TABLE "Question" ADD COLUMN "errorFeedback" TEXT;
ALTER TABLE "Question" ADD COLUMN "hints" TEXT;
ALTER TABLE "Question" ADD COLUMN "learningObjective" TEXT;
ALTER TABLE "Question" ADD COLUMN "stepByStepSolution" TEXT;

-- CreateTable
CREATE TABLE "StudentContext" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "learningStyle" TEXT,
    "preferredDifficulty" TEXT NOT NULL DEFAULT 'medium',
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "totalLearningTime" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "wrongAnswers" INTEGER NOT NULL DEFAULT 0,
    "averageScore" REAL NOT NULL DEFAULT 0,
    "streakCount" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "currentMood" TEXT NOT NULL DEFAULT 'neutral',
    "lastMoodUpdate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "averageConfidence" REAL NOT NULL DEFAULT 70,
    "averageEngagement" REAL NOT NULL DEFAULT 80,
    "strugglingTopics" TEXT,
    "masteredTopics" TEXT,
    "recentTopics" TEXT,
    "strengths" TEXT,
    "weaknesses" TEXT,
    "lastInteractionTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "questionsAsked" INTEGER NOT NULL DEFAULT 0,
    "hintsRequested" INTEGER NOT NULL DEFAULT 0,
    "breaksRequested" INTEGER NOT NULL DEFAULT 0,
    "sessionsCompleted" INTEGER NOT NULL DEFAULT 0,
    "conversationHistory" TEXT,
    "preferences" TEXT,
    "achievementPreferences" TEXT,
    "notificationPreferences" TEXT,
    "parentNotified" BOOLEAN NOT NULL DEFAULT false,
    "lastParentReport" DATETIME,
    "parentReportFrequency" TEXT NOT NULL DEFAULT 'weekly',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentContext_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmotionalState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT,
    "mood" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "engagement" INTEGER NOT NULL,
    "stress" INTEGER NOT NULL DEFAULT 0,
    "indicators" TEXT,
    "triggers" TEXT,
    "systemResponse" TEXT,
    "suggestions" TEXT,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "EmotionalState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisualElement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "specifications" TEXT,
    "url" TEXT,
    "alternativeText" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VisualElement_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InteractiveComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "config" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InteractiveComponent_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentQuality" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "contentScore" INTEGER NOT NULL DEFAULT 0,
    "pedagogicalScore" INTEGER NOT NULL DEFAULT 0,
    "engagementScore" INTEGER NOT NULL DEFAULT 0,
    "overallScore" INTEGER NOT NULL DEFAULT 0,
    "lastAssessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessmentDetails" TEXT,
    CONSTRAINT "ContentQuality_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Content" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "fullText" TEXT NOT NULL,
    "summary" TEXT,
    "keyPoints" TEXT,
    "examples" TEXT,
    "exercises" TEXT,
    "enrichedContent" TEXT,
    "lastEnrichedAt" DATETIME,
    "enrichmentLevel" INTEGER NOT NULL DEFAULT 0,
    "adaptiveContent" TEXT,
    "emotionalSupport" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Content_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Content" ("createdAt", "examples", "exercises", "fullText", "id", "keyPoints", "lessonId", "summary", "updatedAt") SELECT "createdAt", "examples", "exercises", "fullText", "id", "keyPoints", "lessonId", "summary", "updatedAt" FROM "Content";
DROP TABLE "Content";
ALTER TABLE "new_Content" RENAME TO "Content";
CREATE UNIQUE INDEX "Content_lessonId_key" ON "Content"("lessonId");
CREATE INDEX "Content_lessonId_idx" ON "Content"("lessonId");
CREATE INDEX "Content_enrichmentLevel_idx" ON "Content"("enrichmentLevel");
CREATE TABLE "new_DailyChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "progress" REAL NOT NULL DEFAULT 0,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "points" INTEGER NOT NULL DEFAULT 10,
    "bonusPoints" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DailyChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_DailyChallenge" ("challengeId", "completed", "date", "id", "progress", "userId") SELECT "challengeId", "completed", "date", "id", "progress", "userId" FROM "DailyChallenge";
DROP TABLE "DailyChallenge";
ALTER TABLE "new_DailyChallenge" RENAME TO "DailyChallenge";
CREATE INDEX "DailyChallenge_userId_idx" ON "DailyChallenge"("userId");
CREATE UNIQUE INDEX "DailyChallenge_userId_challengeId_date_key" ON "DailyChallenge"("userId", "challengeId", "date");
CREATE TABLE "new_Example" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT,
    "difficulty" TEXT,
    "visualAid" TEXT,
    "relatedConcept" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Example_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Example" ("createdAt", "id", "lessonId", "order", "problem", "solution", "updatedAt") SELECT "createdAt", "id", "lessonId", "order", "problem", "solution", "updatedAt" FROM "Example";
DROP TABLE "Example";
ALTER TABLE "new_Example" RENAME TO "Example";
CREATE INDEX "Example_lessonId_idx" ON "Example"("lessonId");
CREATE TABLE "new_LearningSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "socketId" TEXT,
    "currentSlide" INTEGER NOT NULL DEFAULT 0,
    "totalSlides" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "emotionalStates" TEXT,
    "interactionCount" INTEGER NOT NULL DEFAULT 0,
    "questionsAsked" INTEGER NOT NULL DEFAULT 0,
    "hintsRequested" INTEGER NOT NULL DEFAULT 0,
    "breaksTaken" INTEGER NOT NULL DEFAULT 0,
    "focusScore" REAL NOT NULL DEFAULT 0,
    "chatHistory" TEXT,
    "slideHistory" TEXT,
    "userPreferences" TEXT,
    "teachingScripts" TEXT,
    CONSTRAINT "LearningSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LearningSession_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_LearningSession" ("chatHistory", "completedAt", "currentSlide", "id", "isActive", "lastActivityAt", "lessonId", "slideHistory", "socketId", "startedAt", "totalSlides", "userId", "userPreferences") SELECT "chatHistory", "completedAt", "currentSlide", "id", "isActive", "lastActivityAt", "lessonId", "slideHistory", "socketId", "startedAt", "totalSlides", "userId", "userPreferences" FROM "LearningSession";
DROP TABLE "LearningSession";
ALTER TABLE "new_LearningSession" RENAME TO "LearningSession";
CREATE INDEX "LearningSession_userId_idx" ON "LearningSession"("userId");
CREATE INDEX "LearningSession_lessonId_idx" ON "LearningSession"("lessonId");
CREATE INDEX "LearningSession_isActive_idx" ON "LearningSession"("isActive");
CREATE UNIQUE INDEX "LearningSession_userId_lessonId_key" ON "LearningSession"("userId", "lessonId");
CREATE TABLE "new_QuizAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "score" REAL,
    "totalQuestions" INTEGER NOT NULL,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "timeSpent" INTEGER,
    "completedAt" DATETIME,
    "emotionalState" TEXT,
    "confidenceLevel" REAL NOT NULL DEFAULT 0,
    "stressLevel" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_QuizAttempt" ("completedAt", "correctAnswers", "createdAt", "id", "lessonId", "score", "timeSpent", "totalQuestions", "userId") SELECT "completedAt", "correctAnswers", "createdAt", "id", "lessonId", "score", "timeSpent", "totalQuestions", "userId" FROM "QuizAttempt";
DROP TABLE "QuizAttempt";
ALTER TABLE "new_QuizAttempt" RENAME TO "QuizAttempt";
CREATE INDEX "QuizAttempt_userId_idx" ON "QuizAttempt"("userId");
CREATE INDEX "QuizAttempt_lessonId_idx" ON "QuizAttempt"("lessonId");
CREATE TABLE "new_QuizAttemptAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "timeSpent" INTEGER,
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizAttemptAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuizAttemptAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_QuizAttemptAnswer" ("attemptId", "createdAt", "id", "isCorrect", "questionId", "timeSpent", "userAnswer") SELECT "attemptId", "createdAt", "id", "isCorrect", "questionId", "timeSpent", "userAnswer" FROM "QuizAttemptAnswer";
DROP TABLE "QuizAttemptAnswer";
ALTER TABLE "new_QuizAttemptAnswer" RENAME TO "QuizAttemptAnswer";
CREATE UNIQUE INDEX "QuizAttemptAnswer_attemptId_questionId_key" ON "QuizAttemptAnswer"("attemptId", "questionId");
CREATE TABLE "new_UserAchievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "points" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "category" TEXT,
    "rarity" TEXT NOT NULL DEFAULT 'common',
    "progress" REAL NOT NULL DEFAULT 100,
    CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserAchievement" ("achievementId", "id", "points", "unlockedAt", "userId") SELECT "achievementId", "id", "points", "unlockedAt", "userId" FROM "UserAchievement";
DROP TABLE "UserAchievement";
ALTER TABLE "new_UserAchievement" RENAME TO "UserAchievement";
CREATE INDEX "UserAchievement_userId_idx" ON "UserAchievement"("userId");
CREATE INDEX "UserAchievement_category_idx" ON "UserAchievement"("category");
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "StudentContext_userId_key" ON "StudentContext"("userId");

-- CreateIndex
CREATE INDEX "StudentContext_userId_idx" ON "StudentContext"("userId");

-- CreateIndex
CREATE INDEX "StudentContext_currentMood_idx" ON "StudentContext"("currentMood");

-- CreateIndex
CREATE INDEX "StudentContext_lastInteractionTime_idx" ON "StudentContext"("lastInteractionTime");

-- CreateIndex
CREATE INDEX "EmotionalState_userId_idx" ON "EmotionalState"("userId");

-- CreateIndex
CREATE INDEX "EmotionalState_detectedAt_idx" ON "EmotionalState"("detectedAt");

-- CreateIndex
CREATE INDEX "EmotionalState_mood_idx" ON "EmotionalState"("mood");

-- CreateIndex
CREATE INDEX "VisualElement_lessonId_idx" ON "VisualElement"("lessonId");

-- CreateIndex
CREATE INDEX "InteractiveComponent_lessonId_idx" ON "InteractiveComponent"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentQuality_lessonId_key" ON "ContentQuality"("lessonId");

-- CreateIndex
CREATE INDEX "ContentQuality_lessonId_idx" ON "ContentQuality"("lessonId");

-- CreateIndex
CREATE INDEX "ContentQuality_overallScore_idx" ON "ContentQuality"("overallScore");
