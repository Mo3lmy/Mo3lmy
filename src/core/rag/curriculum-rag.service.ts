import { z } from 'zod';
import { prisma } from '../../config/database.config';
import { NotFoundError } from '../../utils/errors';
import { ragService } from './rag.service';
import { vectorSearch } from './vector.search';
import { documentProcessor } from './document.processor';
import type {
  CurriculumSearchQuery,
  CurriculumSearchResult,
  ConceptExplanation,
  CurriculumInsight,
  AdaptiveContent,
  CurriculumRAGResponse,
  FormulaExplanation
} from '../../types/curriculum.types';

// Validation schemas
const searchSchema = z.object({
  query: z.string().min(2).max(500),
  subjectId: z.string().optional(),
  unitId: z.string().optional(),
  lessonId: z.string().optional(),
  grade: z.number().min(1).max(12).optional(),
  limit: z.number().min(1).max(20).default(5),
  includeExamples: z.boolean().default(false),
  includeFormulas: z.boolean().default(false),
});

export class CurriculumRAGService {
  
  /**
   * Search curriculum with advanced RAG
   */
  async searchCurriculum(
    query: CurriculumSearchQuery
  ): Promise<CurriculumSearchResult[]> {
    console.log('🔍 Searching curriculum with query:', query);
    
    // Validate input
    const validated = searchSchema.parse(query);
    
    // Build search filters
    const filters: any = {};
    if (validated.lessonId) filters.lessonId = validated.lessonId;
    if (validated.unitId) filters.unitId = validated.unitId;
    if (validated.subjectId) filters.subjectId = validated.subjectId;
    if (validated.grade) filters.grade = validated.grade;
    
    // Perform vector search
    const searchResults = await vectorSearch.searchSimilar(
      validated.query,
      validated.limit
    );
    
    // Format results
    const results: CurriculumSearchResult[] = [];
    
    for (const result of searchResults) {
      const enrichedResult = await this.enrichSearchResult(
        result,
        validated.includeExamples,
        validated.includeFormulas
      );
      results.push(enrichedResult);
    }
    
    return results;
  }
  
  /**
   * Explain a concept in simple terms
   */
  async explainConcept(
    conceptId: string,
    gradeLevel: number
  ): Promise<ConceptExplanation> {
    console.log(`📖 Explaining concept ${conceptId} for grade ${gradeLevel}`);
    
    // Get concept from database
    const concept = await prisma.concept.findUnique({
      where: { id: conceptId },
      include: {
        lesson: {
          include: {
            unit: {
              include: { subject: true }
            }
          }
        }
      }
    });
    
    if (!concept) {
      throw new NotFoundError('Concept');
    }
    
    // Generate explanations using RAG
    const simpleExplanation = await ragService.explainConcept(
      concept.name,
      gradeLevel
    );
    
    // Generate detailed explanation
    const detailedExplanation = await this.generateDetailedExplanation(
      concept,
      gradeLevel
    );
    
    // Find related concepts
    const relatedConcepts = await this.findRelatedConcepts(conceptId);
    
    return {
      conceptId: concept.id,
      conceptName: concept.name,
      simpleExplanation,
      detailedExplanation,
      examples: [], // No examples relation available
      relatedConcepts,
      difficulty: 'MEDIUM', // Default difficulty
      gradeLevel,
    };
  }
  
  /**
   * Get curriculum insights for a lesson
   */
  async getLessonInsights(lessonId: string): Promise<CurriculumInsight> {
    console.log(`💡 Generating insights for lesson ${lessonId}`);
    
    // Get lesson with all related data
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        content: true,
        concepts: true,
        examples: true,
        questions: true,
        unit: {
          include: { subject: true }
        }
      }
    });
    
    if (!lesson) {
      throw new NotFoundError('Lesson');
    }
    
    // Extract main topics from concepts
    const mainTopics = lesson.concepts.map(c => c.name);
    
    // Analyze key skills
    const keySkills = await this.analyzeKeySkills(lesson);
    
    // Determine prerequisites
    const prerequisites = await this.findPrerequisites(lesson);
    
    // Extract learning objectives
    const learningObjectives = await this.extractLearningObjectives(lesson);
    
    // Identify common misconceptions
    const commonMisconceptions = await this.identifyMisconceptions(lesson);
    
    // Generate study tips
    const studyTips = await this.generateStudyTips(lesson);
    
    // Calculate estimated study time
    const estimatedStudyTime = this.calculateStudyTime(lesson);
    
    return {
      lessonId,
      insights: {
        mainTopics,
        keySkills,
        prerequisites,
        learningObjectives,
        commonMisconceptions,
        studyTips,
      },
      estimatedStudyTime,
      difficulty: lesson.difficulty || 'MEDIUM',
    };
  }
  
  /**
   * Generate adaptive content based on student performance
   */
  async generateAdaptiveContent(
    userId: string,
    lessonId: string
  ): Promise<AdaptiveContent> {
    console.log(`🎯 Generating adaptive content for user ${userId}`);
    
    // Get user's learning profile
    const learningProfile = await this.getUserLearningProfile(userId);
    
    // Get lesson content
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        content: true,
        concepts: true,
      }
    });
    
    if (!lesson) {
      throw new NotFoundError('Lesson');
    }
    
    // Analyze user's weak and strong areas
    const { weakAreas, strongAreas } = await this.analyzeUserStrengths(userId);
    
    // Generate personalized summary
    const summary = await this.generatePersonalizedSummary(
      lesson,
      learningProfile,
      weakAreas
    );
    
    // Determine focus areas
    const focusAreas = this.determineFocusAreas(
      lesson.concepts.map(c => c.name),
      weakAreas
    );
    
    // Identify topics to skip
    const skipTopics = this.identifySkipTopics(
      lesson.concepts.map(c => c.name),
      strongAreas,
      learningProfile.previousPerformance
    );
    
    // Generate additional exercises
    const additionalExercises = await this.generateAdditionalExercises(
      lessonId,
      weakAreas
    );
    
    // Determine recommended pace
    const recommendedPace = this.determineRecommendedPace(learningProfile);
    
    return {
      userId,
      lessonId,
      personalizedContent: {
        summary,
        focusAreas,
        skipTopics,
        additionalExercises,
        recommendedPace,
      },
      basedOn: {
        previousPerformance: learningProfile.previousPerformance,
        learningStyle: learningProfile.learningStyle,
        weakAreas,
        strongAreas,
      },
    };
  }
  
  /**
   * Answer curriculum questions with RAG
   */
  async answerQuestion(
    query: string,
    context?: {
      lessonId?: string;
      userId?: string;
      includeVisuals?: boolean;
    }
  ): Promise<CurriculumRAGResponse> {
    console.log(`❓ Answering curriculum question: ${query}`);
    
    // Get RAG response
    const ragResponse = await ragService.answerQuestion(
      query,
      context?.lessonId,
      context?.userId
    );
    
    // Enhance with curriculum-specific features
    const suggestions = await this.generateFollowUpSuggestions(query);
    const relatedQuestions = await this.findRelatedQuestions(query);
    
    // Add visual aids if requested
    let visualAids;
    if (context?.includeVisuals) {
      visualAids = await this.findRelevantVisualAids(query, context.lessonId);
    }
    
    // Format search results
    const sources: CurriculumSearchResult[] = ragResponse.sources.map(source => ({
      id: source.chunk.id,
      type: 'lesson',
      title: source.chunk.metadata.title || 'Unknown',
      content: source.chunk.text,
      relevanceScore: source.score,
      metadata: {
        lessonId: source.chunk.metadata.lessonId,
        lessonTitle: source.lessonInfo?.title,
        unitTitle: source.lessonInfo?.unitTitle,
        subjectName: source.lessonInfo?.subjectName,
      },
    }));
    
    return {
      query,
      answer: ragResponse.answer,
      confidence: ragResponse.confidence,
      sources,
      suggestions,
      relatedQuestions,
      visualAids,
    };
  }
  
  /**
   * Explain formulas with examples
   */
  async explainFormula(formulaId: string): Promise<FormulaExplanation> {
    console.log(`📐 Explaining formula ${formulaId}`);
    
    const formula = await prisma.formula.findUnique({
      where: { id: formulaId },
    });
    
    if (!formula) {
      throw new NotFoundError('Formula');
    }
    
    // Parse formula data from description
    const formulaData = {
      variables: [],
      examples: []
    };
    
    return {
      id: formula.id,
      formula: formula.expression,
      variables: formulaData.variables || [],
      usage: formula.description || '',
      examples: formulaData.examples || [],
    };
  }
  
  // Helper methods
  
  private async enrichSearchResult(
    result: any,
    includeExamples: boolean,
    includeFormulas: boolean
  ): Promise<CurriculumSearchResult> {
    const metadata: any = {
      lessonId: result.chunk.metadata.lessonId,
    };
    
    // Get additional metadata
    if (metadata.lessonId) {
      const lesson = await prisma.lesson.findUnique({
        where: { id: metadata.lessonId },
        include: {
          unit: {
            include: { subject: true }
          }
        }
      });
      
      if (lesson) {
        metadata.lessonTitle = lesson.title;
        metadata.unitTitle = lesson.unit.title;
        metadata.subjectName = lesson.unit.subject.name;
        metadata.grade = lesson.unit.subject.grade;
        metadata.difficulty = lesson.difficulty;
      }
    }
    
    return {
      id: result.chunk.id,
      type: 'lesson',
      title: result.chunk.metadata.title || '',
      content: result.chunk.text,
      relevanceScore: result.score,
      metadata,
      highlights: this.generateHighlights(result.chunk.text),
    };
  }
  
  private async generateDetailedExplanation(
    concept: any,
    gradeLevel: number
  ): Promise<string> {
    const prompt = `اشرح مفهوم "${concept.name}" بالتفصيل لطالب في الصف ${gradeLevel}.
    التعريف: ${concept.definition}
    الأهمية: ${concept.importance}`;
    
    // Use AI to generate explanation
    return await ragService.explainConcept(concept.name, gradeLevel);
  }
  
  private formatExamples(examples: any[]): any[] {
    return examples.map(ex => ({
      id: ex.id,
      title: ex.problem || 'مثال',
      description: ex.solution || '',
      solution: ex.solution,
      visualAid: undefined,
      category: this.categorizeExample(ex),
    }));
  }
  
  private categorizeExample(example: any): 'real_life' | 'mathematical' | 'scientific' | 'practical' {
    // Simple categorization based on content
    const content = `${example.title} ${example.description}`.toLowerCase();
    
    if (content.includes('حياة') || content.includes('يومي')) return 'real_life';
    if (content.includes('معادلة') || content.includes('حساب')) return 'mathematical';
    if (content.includes('علمي') || content.includes('تجربة')) return 'scientific';
    return 'practical';
  }
  
  private async findRelatedConcepts(conceptId: string): Promise<string[]> {
    // Find concepts in the same lesson
    const concept = await prisma.concept.findUnique({
      where: { id: conceptId },
      include: {
        lesson: {
          include: { concepts: true }
        }
      }
    });
    
    if (!concept) return [];
    
    return concept.lesson.concepts
      .filter((c: { id: string; name: string }) => c.id !== conceptId)
      .map((c: { id: string; name: string }) => c.name)
      .slice(0, 5);
  }
  
  private async analyzeKeySkills(lesson: any): Promise<string[]> {
    // Extract skills from lesson content
    const skills = [];
    
    if (lesson.content?.keyPoints) {
      const keyPoints = JSON.parse(lesson.content.keyPoints);
      skills.push(...keyPoints.slice(0, 3));
    }
    
    return skills;
  }
  
  private async findPrerequisites(lesson: any): Promise<string[]> {
    // Find previous lesson in the unit
    const previousLessons = await prisma.lesson.findMany({
      where: {
        unitId: lesson.unitId,
        order: { lt: lesson.order }
      },
      orderBy: { order: 'desc' },
      take: 2,
    });
    
    return previousLessons.map(l => l.title);
  }
  
  private async extractLearningObjectives(lesson: any): Promise<string[]> {
    const objectives = [];
    
    // Extract from lesson description
    if (lesson.description) {
      objectives.push(lesson.description);
    }
    
    // Extract from concepts
    const concepts = lesson.concepts.slice(0, 3);
    objectives.push(...concepts.map((c: { name: any; }) => `فهم ${c.name}`));
    
    return objectives;
  }
  
  private async identifyMisconceptions(lesson: any): Promise<string[]> {
    // Common misconceptions based on subject
    const subjectName = lesson.unit.subject.name;
    
    if (subjectName.includes('رياضيات')) {
      return ['الخلط بين العمليات الحسابية', 'عدم فهم أولويات العمليات'];
    }
    
    if (subjectName.includes('علوم')) {
      return ['الخلط بين المفاهيم المتشابهة', 'التطبيق الخاطئ للقوانين'];
    }
    
    return ['عدم ربط المفاهيم ببعضها'];
  }
  
  private async generateStudyTips(lesson: any): Promise<string[]> {
    const tips = [
      'اقرأ الدرس كاملاً أولاً',
      'دون الملاحظات المهمة',
      'حل التمارين بالتدريج',
    ];
    
    if (lesson.difficulty === 'HARD') {
      tips.push('راجع الدروس السابقة', 'اطلب المساعدة عند الحاجة');
    }
    
    return tips;
  }
  
  private calculateStudyTime(lesson: any): number {
    let baseTime = lesson.duration || 30;
    
    // Add time based on content
    if (lesson.concepts.length > 3) baseTime += 10;
    if (lesson.examples.length > 2) baseTime += 10;
    if (lesson.questions.length > 5) baseTime += 15;
    
    return baseTime;
  }
  
  private async getUserLearningProfile(userId: string): Promise<any> {
    // Get user progress data
    const progress = await prisma.progress.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });
    
    const quizAttempts = await prisma.quizAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    
    // Calculate average performance
    const avgScore = quizAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / 
                    (quizAttempts.length || 1);
    
    return {
      previousPerformance: avgScore,
      learningStyle: 'visual', // Could be determined from user preferences
      progressHistory: progress,
      quizHistory: quizAttempts,
    };
  }
  
  private async analyzeUserStrengths(userId: string): Promise<{
    weakAreas: string[];
    strongAreas: string[];
  }> {
    // Analyze quiz performance by topic
    const quizResults = await prisma.quizAttemptAnswer.findMany({
      where: {
        attempt: { userId }
      },
      include: {
        question: {
          include: {
            lesson: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    
    // Group by lesson and calculate accuracy
    const lessonAccuracy = new Map<string, number>();
    const lessonAttempts = new Map<string, number>();
    
    quizResults.forEach(result => {
      const lessonTitle = result.question.lesson.title;
      const current = lessonAccuracy.get(lessonTitle) || 0;
      const attempts = lessonAttempts.get(lessonTitle) || 0;
      
      lessonAccuracy.set(lessonTitle, current + (result.isCorrect ? 1 : 0));
      lessonAttempts.set(lessonTitle, attempts + 1);
    });
    
    const weakAreas: string[] = [];
    const strongAreas: string[] = [];
    
    lessonAccuracy.forEach((correct, lesson) => {
      const attempts = lessonAttempts.get(lesson) || 1;
      const accuracy = correct / attempts;
      
      if (accuracy < 0.6) weakAreas.push(lesson);
      if (accuracy > 0.8) strongAreas.push(lesson);
    });
    
    return { weakAreas, strongAreas };
  }
  
  private async generatePersonalizedSummary(
    lesson: any,
    profile: any,
    weakAreas: string[]
  ): Promise<string> {
    let summary = lesson.content?.summary || '';
    
    // Add emphasis on weak areas
    if (weakAreas.length > 0) {
      summary += '\n\n⚠️ ركز بشكل خاص على المفاهيم المتعلقة بـ: ' + weakAreas.join(', ');
    }
    
    return summary;
  }
  
  private determineFocusAreas(
    concepts: string[],
    weakAreas: string[]
  ): string[] {
    // Focus on concepts related to weak areas
    return concepts.filter(concept => 
      weakAreas.some(weak => concept.includes(weak) || weak.includes(concept))
    );
  }
  
  private identifySkipTopics(
    concepts: string[],
    strongAreas: string[],
    performance: number
  ): string[] {
    // Skip only if performance is very high
    if (performance < 85) return [];
    
    return concepts.filter(concept =>
      strongAreas.some(strong => concept.includes(strong) || strong.includes(concept))
    ).slice(0, 2);
  }
  
  private async generateAdditionalExercises(
    lessonId: string,
    weakAreas: string[]
  ): Promise<string[]> {
    // Generate exercise suggestions
    const exercises = [];
    
    for (const area of weakAreas.slice(0, 3)) {
      exercises.push(`تمارين إضافية على ${area}`);
    }
    
    return exercises;
  }
  
  private determineRecommendedPace(profile: any): 'slow' | 'normal' | 'fast' {
    if (profile.previousPerformance < 60) return 'slow';
    if (profile.previousPerformance > 85) return 'fast';
    return 'normal';
  }
  
  private generateHighlights(text: string): string[] {
    // Extract key sentences
    const sentences = text.split('.');
    return sentences
      .filter(s => s.length > 20 && s.length < 100)
      .slice(0, 3)
      .map(s => s.trim());
  }
  
  private async generateFollowUpSuggestions(query: string): Promise<string[]> {
    return [
      `اشرح ${query} بطريقة أبسط`,
      `أعطني أمثلة على ${query}`,
      `ما هي التطبيقات العملية لـ ${query}؟`,
    ];
  }
  
  private async findRelatedQuestions(query: string): Promise<string[]> {
    // Search for similar questions in the database
    const questions = await prisma.question.findMany({
      where: {
        question: { contains: query.split(' ')[0] }
      },
      take: 3,
    });
    
    return questions.map(q => q.question);
  }
  
  private async findRelevantVisualAids(
    query: string,
    lessonId?: string
  ): Promise<any[]> {
    const visuals: any[] = [];
    
    if (lessonId) {
      const examples = await prisma.example.findMany({
        where: { lessonId },
        take: 2,
      });
      
      // Examples don't have imageUrl, so return empty array
      // Would need to add visual aids from another source
    }
    
    return visuals;
  }
}

// Export singleton instance
export const curriculumRAGService = new CurriculumRAGService();