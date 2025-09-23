// 📍 المكان: src/services/presentation/progressive-presenter.service.ts  
// الوظيفة: إدارة العرض التدريجي المتقدم مع التزامن والتأثيرات

import { EventEmitter } from 'events';
import { lessonFlowManager, type FlowContext } from '../flow/lesson-flow-manager.service';
import { websocketService } from '../websocket/websocket.service';
import { audioGenerator } from '../../core/video/audio.generator';
import type { GeneratedSlide, LessonSection } from '../orchestrator/lesson-orchestrator.service';

// ============= TYPES =============

/**
 * حالة العرض التدريجي
 */
export interface ProgressiveState {
  isActive: boolean;
  isPaused: boolean;
  currentSlideIndex: number;
  currentPointIndex: number;
  revealedPoints: number[];
  timeline: Timeline;
  audioSync: AudioSyncState;
  animations: AnimationState;
  userInteractions: InteractionRecord[];
}

/**
 * الجدول الزمني للعرض
 */
export interface Timeline {
  startTime: Date;
  elapsedTime: number;
  totalDuration: number;
  points: TimelinePoint[];
  currentPosition: number;
  playbackSpeed: number;
}

/**
 * نقطة في الجدول الزمني
 */
export interface TimelinePoint {
  id: string;
  type: 'slide_start' | 'point_reveal' | 'animation' | 'audio_segment' | 'pause' | 'interaction';
  timestamp: number; // milliseconds from start
  duration: number;
  data: any;
  completed: boolean;
}

/**
 * حالة تزامن الصوت
 */
export interface AudioSyncState {
  isPlaying: boolean;
  currentSegment: number;
  audioUrl?: string;
  segments: AudioSegment[];
  volume: number;
  muted: boolean;
}

/**
 * قطعة صوتية
 */
export interface AudioSegment {
  id: string;
  url?: string;
  text: string;
  startTime: number;
  duration: number;
  pointIndex: number;
}

/**
 * حالة الأنيميشن
 */
export interface AnimationState {
  currentAnimations: Animation[];
  queuedAnimations: Animation[];
  completedAnimations: string[];
}

/**
 * أنيميشن
 */
export interface Animation {
  id: string;
  type: 'fade' | 'slide' | 'zoom' | 'highlight' | 'underline' | 'bounce' | 'glow';
  target: string; // CSS selector
  duration: number;
  delay: number;
  easing: string;
  properties?: Record<string, any>;
}

/**
 * سجل التفاعل
 */
export interface InteractionRecord {
  timestamp: number;
  type: 'click' | 'hover' | 'pause' | 'resume' | 'skip' | 'replay' | 'speed_change';
  target?: string;
  value?: any;
}

/**
 * خيارات العرض
 */
export interface PresentationOptions {
  autoAdvance: boolean;
  progressiveReveal: boolean;
  audioEnabled: boolean;
  animationsEnabled: boolean;
  interactionTracking: boolean;
  defaultRevealDelay: number; // milliseconds
  defaultAnimationDuration: number;
  pauseOnInteraction: boolean;
  adaptiveSpeed: boolean; // Adjust speed based on user interactions
}

// ============= PROGRESSIVE PRESENTER SERVICE =============

export class ProgressivePresenterService extends EventEmitter {
  private presentations: Map<string, ProgressiveState> = new Map();
  private timers: Map<string, NodeJS.Timeout[]> = new Map();
  private animationFrames: Map<string, number> = new Map();
  
  constructor() {
    super();
  }
  
  /**
   * بدء عرض تدريجي جديد
   */
  async startPresentation(
    userId: string,
    lessonId: string,
    slide: GeneratedSlide,
    options: Partial<PresentationOptions> = {}
  ): Promise<ProgressiveState> {
    console.log(`🎬 Starting progressive presentation for slide ${slide.number}`);
    
    const presentationKey = `${userId}-${lessonId}-${slide.number}`;
    
    // إيقاف أي عرض سابق
    if (this.presentations.has(presentationKey)) {
      await this.stopPresentation(presentationKey);
    }
    
    // إنشاء حالة العرض
    const state = this.createPresentationState(slide, options);
    this.presentations.set(presentationKey, state);
    
    // بناء الجدول الزمني
    await this.buildTimeline(state, slide);
    
    // بدء التشغيل
    if (options.autoAdvance !== false) {
      await this.play(presentationKey);
    }
    
    // إرسال حالة البداية
    this.sendPresentationStarted(userId, lessonId, state);
    
    return state;
  }
  
  /**
   * إنشاء حالة العرض
   */
  private createPresentationState(
    slide: GeneratedSlide,
    options: Partial<PresentationOptions>
  ): ProgressiveState {
    return {
      isActive: true,
      isPaused: false,
      currentSlideIndex: slide.number,
      currentPointIndex: -1,
      revealedPoints: [],
      timeline: {
        startTime: new Date(),
        elapsedTime: 0,
        totalDuration: slide.duration * 1000, // Convert to milliseconds
        points: [],
        currentPosition: 0,
        playbackSpeed: 1
      },
      audioSync: {
        isPlaying: false,
        currentSegment: 0,
        segments: [],
        volume: 1,
        muted: false
      },
      animations: {
        currentAnimations: [],
        queuedAnimations: [],
        completedAnimations: []
      },
      userInteractions: []
    };
  }
  
  /**
   * بناء الجدول الزمني
   */
  private async buildTimeline(
    state: ProgressiveState,
    slide: GeneratedSlide
  ): Promise<void> {
    const timeline = state.timeline;
    let currentTime = 0;
    
    // إضافة بداية الشريحة
    timeline.points.push({
      id: `slide-start-${slide.number}`,
      type: 'slide_start',
      timestamp: currentTime,
      duration: 500, // Initial pause
      data: { slideNumber: slide.number },
      completed: false
    });
    currentTime += 500;
    
    // إضافة النقاط التدريجية
    if (slide.points && slide.points.length > 0) {
      const pointTimings = slide.pointTimings || this.calculatePointTimings(slide);
      
      for (let i = 0; i < slide.points.length; i++) {
        // Animation before reveal
        timeline.points.push({
          id: `animation-${i}`,
          type: 'animation',
          timestamp: currentTime,
          duration: 300,
          data: {
            animation: this.getRevealAnimation(i)
          },
          completed: false
        });
        currentTime += 300;
        
        // Point reveal
        timeline.points.push({
          id: `point-${i}`,
          type: 'point_reveal',
          timestamp: currentTime,
          duration: pointTimings[i] * 1000,
          data: {
            pointIndex: i,
            content: slide.points[i]
          },
          completed: false
        });
        
        // Audio segment if available
        if (slide.audioSegments && slide.audioSegments[i]) {
          timeline.points.push({
            id: `audio-${i}`,
            type: 'audio_segment',
            timestamp: currentTime,
            duration: pointTimings[i] * 1000,
            data: {
              segmentIndex: i,
              audioUrl: slide.audioSegments[i]
            },
            completed: false
          });
        }
        
        currentTime += pointTimings[i] * 1000;
        
        // Pause between points
        if (i < slide.points.length - 1) {
          timeline.points.push({
            id: `pause-${i}`,
            type: 'pause',
            timestamp: currentTime,
            duration: 500,
            data: {},
            completed: false
          });
          currentTime += 500;
        }
      }
    } else {
      // شريحة بدون نقاط تدريجية
      timeline.points.push({
        id: `content-reveal`,
        type: 'point_reveal',
        timestamp: currentTime,
        duration: slide.duration * 1000,
        data: {
          pointIndex: 0,
          content: slide.content
        },
        completed: false
      });
    }
    
    timeline.totalDuration = currentTime;
  }
  
  /**
   * تشغيل العرض
   */
  async play(presentationKey: string): Promise<void> {
    const state = this.presentations.get(presentationKey);
    if (!state || !state.isActive) return;
    
    state.isPaused = false;
    
    // بدء التقدم في Timeline
    this.startTimelineProgression(presentationKey);
    
    // بدء الصوت إذا كان متاحاً
    if (state.audioSync.segments.length > 0 && !state.audioSync.muted) {
      await this.startAudioPlayback(presentationKey);
    }
    
    this.emit('presentation_playing', { presentationKey });
  }
  
  /**
   * إيقاف مؤقت
   */
  async pause(presentationKey: string): Promise<void> {
    const state = this.presentations.get(presentationKey);
    if (!state) return;
    
    state.isPaused = true;
    
    // إيقاف كل المؤقتات
    this.clearTimers(presentationKey);
    
    // إيقاف الصوت
    if (state.audioSync.isPlaying) {
      this.pauseAudio(presentationKey);
    }
    
    // إيقاف الأنيميشن
    this.pauseAnimations(presentationKey);
    
    // تسجيل التفاعل
    state.userInteractions.push({
      timestamp: Date.now() - state.timeline.startTime.getTime(),
      type: 'pause'
    });
    
    this.emit('presentation_paused', { 
      presentationKey,
      currentPosition: state.timeline.currentPosition 
    });
  }
  
  /**
   * استئناف العرض
   */
  async resume(presentationKey: string): Promise<void> {
    const state = this.presentations.get(presentationKey);
    if (!state || !state.isPaused) return;
    
    state.isPaused = false;
    
    // تسجيل التفاعل
    state.userInteractions.push({
      timestamp: Date.now() - state.timeline.startTime.getTime(),
      type: 'resume'
    });
    
    // استئناف من النقطة الحالية
    await this.play(presentationKey);
    
    this.emit('presentation_resumed', { presentationKey });
  }
  
  /**
   * القفز لنقطة معينة
   */
  async jumpToPoint(
    presentationKey: string,
    pointIndex: number
  ): Promise<void> {
    const state = this.presentations.get(presentationKey);
    if (!state) return;
    
    // إيقاف العرض الحالي
    await this.pause(presentationKey);
    
    // تحديث الموقع
    state.currentPointIndex = pointIndex;
    state.revealedPoints = Array.from({length: pointIndex + 1}, (_, i) => i);
    
    // العثور على النقطة في Timeline
    const pointTimelineIndex = state.timeline.points.findIndex(
      p => p.type === 'point_reveal' && p.data.pointIndex === pointIndex
    );
    
    if (pointTimelineIndex >= 0) {
      state.timeline.currentPosition = pointTimelineIndex;
      
      // كشف النقطة فوراً
      await this.revealPoint(presentationKey, pointIndex);
      
      // استئناف من هنا إذا لم يكن متوقفاً
      if (!state.isPaused) {
        await this.resume(presentationKey);
      }
    }
  }
  
  /**
   * تغيير السرعة
   */
  setSpeed(presentationKey: string, speed: number): void {
    const state = this.presentations.get(presentationKey);
    if (!state) return;
    
    state.timeline.playbackSpeed = speed;
    
    // تسجيل التفاعل
    state.userInteractions.push({
      timestamp: Date.now() - state.timeline.startTime.getTime(),
      type: 'speed_change',
      value: speed
    });
    
    // إعادة حساب المؤقتات إذا كان يعمل
    if (!state.isPaused) {
      this.clearTimers(presentationKey);
      this.startTimelineProgression(presentationKey);
    }
    
    this.emit('speed_changed', { presentationKey, speed });
  }
  
  /**
   * التقدم في الجدول الزمني
   */
  private startTimelineProgression(presentationKey: string): void {
    const state = this.presentations.get(presentationKey);
    if (!state) return;
    
    const processNextPoint = () => {
      if (state.isPaused || !state.isActive) return;
      
      const currentPoint = state.timeline.points[state.timeline.currentPosition];
      if (!currentPoint || currentPoint.completed) {
        // انتقل للنقطة التالية
        state.timeline.currentPosition++;
        
        if (state.timeline.currentPosition >= state.timeline.points.length) {
          // انتهى العرض
          this.completePresentation(presentationKey);
          return;
        }
        
        // معالجة النقطة التالية
        processNextPoint();
        return;
      }
      
      // تنفيذ النقطة الحالية
      this.executeTimelinePoint(presentationKey, currentPoint);
      
      // جدولة النقطة التالية
      const adjustedDuration = currentPoint.duration / state.timeline.playbackSpeed;
      const timer = setTimeout(() => {
        currentPoint.completed = true;
        processNextPoint();
      }, adjustedDuration);
      
      // حفظ المؤقت
      const timers = this.timers.get(presentationKey) || [];
      timers.push(timer);
      this.timers.set(presentationKey, timers);
    };
    
    // بدء المعالجة
    processNextPoint();
  }
  
  /**
   * تنفيذ نقطة في الجدول الزمني
   */
  private async executeTimelinePoint(
    presentationKey: string,
    point: TimelinePoint
  ): Promise<void> {
    const state = this.presentations.get(presentationKey);
    if (!state) return;
    
    const [userId, lessonId] = presentationKey.split('-');
    
    switch (point.type) {
      case 'slide_start':
        this.emit('slide_started', {
          userId,
          lessonId,
          slideNumber: point.data.slideNumber
        });
        break;
        
      case 'point_reveal':
        await this.revealPoint(presentationKey, point.data.pointIndex);
        break;
        
      case 'animation':
        await this.playAnimation(presentationKey, point.data.animation);
        break;
        
      case 'audio_segment':
        if (state.audioSync.segments[point.data.segmentIndex]) {
          await this.playAudioSegment(presentationKey, point.data.segmentIndex);
        }
        break;
        
      case 'pause':
        // Pause is just a delay, nothing to execute
        break;
    }
  }
  
  /**
   * كشف نقطة
   */
  private async revealPoint(
    presentationKey: string,
    pointIndex: number
  ): Promise<void> {
    const state = this.presentations.get(presentationKey);
    if (!state) return;
    
    const [userId, lessonId, slideNumber] = presentationKey.split('-');
    
    state.currentPointIndex = pointIndex;
    state.revealedPoints.push(pointIndex);
    
    // إرسال الحدث للواجهة
    websocketService.sendToUser(userId, 'point_revealed', {
      lessonId,
      slideNumber: parseInt(slideNumber),
      pointIndex,
      animation: 'fadeIn',
      duration: 500
    });
    
    this.emit('point_revealed', {
      presentationKey,
      pointIndex,
      timestamp: Date.now() - state.timeline.startTime.getTime()
    });
  }
  
  /**
   * تشغيل أنيميشن
   */
  private async playAnimation(
    presentationKey: string,
    animation: Animation
  ): Promise<void> {
    const state = this.presentations.get(presentationKey);
    if (!state) return;
    
    const [userId, lessonId] = presentationKey.split('-');
    
    // إضافة للأنيميشنز الحالية
    state.animations.currentAnimations.push(animation);
    
    // إرسال للواجهة
    websocketService.sendToUser(userId, 'animation_start', {
      lessonId,
      animation: {
        id: animation.id,
        type: animation.type,
        target: animation.target,
        duration: animation.duration,
        easing: animation.easing,
        properties: animation.properties
      }
    });
    
    // إزالة من الحالية بعد الانتهاء
    setTimeout(() => {
      const index = state.animations.currentAnimations.indexOf(animation);
      if (index > -1) {
        state.animations.currentAnimations.splice(index, 1);
        state.animations.completedAnimations.push(animation.id);
      }
    }, animation.duration);
  }
  
  /**
   * تشغيل قطعة صوتية
   */
  private async playAudioSegment(
    presentationKey: string,
    segmentIndex: number
  ): Promise<void> {
    const state = this.presentations.get(presentationKey);
    if (!state || state.audioSync.muted) return;
    
    const [userId, lessonId] = presentationKey.split('-');
    const segment = state.audioSync.segments[segmentIndex];
    
    if (segment && segment.url) {
      state.audioSync.isPlaying = true;
      state.audioSync.currentSegment = segmentIndex;
      
      websocketService.sendToUser(userId, 'audio_play', {
        lessonId,
        audioUrl: segment.url,
        segmentIndex,
        volume: state.audioSync.volume
      });
    }
  }
  
  /**
   * إكمال العرض
   */
  private async completePresentation(presentationKey: string): Promise<void> {
    const state = this.presentations.get(presentationKey);
    if (!state) return;
    
    const [userId, lessonId, slideNumber] = presentationKey.split('-');
    
    state.isActive = false;
    
    // حساب الإحصائيات
    const stats = this.calculatePresentationStats(state);
    
    // إرسال حدث الإكمال
    websocketService.sendToUser(userId, 'slide_completed', {
      lessonId,
      slideNumber: parseInt(slideNumber),
      stats
    });
    
    this.emit('presentation_completed', {
      presentationKey,
      stats
    });
    
    // تنظيف
    this.cleanupPresentation(presentationKey);
  }
  
  /**
   * حساب إحصائيات العرض
   */
  private calculatePresentationStats(state: ProgressiveState): any {
    const totalTime = Date.now() - state.timeline.startTime.getTime();
    const pauseCount = state.userInteractions.filter(i => i.type === 'pause').length;
    const speedChanges = state.userInteractions.filter(i => i.type === 'speed_change').length;
    
    return {
      totalDuration: totalTime,
      pointsRevealed: state.revealedPoints.length,
      animationsPlayed: state.animations.completedAnimations.length,
      pauseCount,
      speedChanges,
      averageSpeed: state.timeline.playbackSpeed,
      interactionCount: state.userInteractions.length,
      completionRate: (state.timeline.currentPosition / state.timeline.points.length) * 100
    };
  }
  
  /**
   * إيقاف العرض
   */
  async stopPresentation(presentationKey: string): Promise<void> {
    const state = this.presentations.get(presentationKey);
    if (!state) return;
    
    state.isActive = false;
    state.isPaused = true;
    
    // إيقاف كل شيء
    this.clearTimers(presentationKey);
    this.stopAudio(presentationKey);
    this.clearAnimations(presentationKey);
    
    this.emit('presentation_stopped', { presentationKey });
  }
  
  /**
   * تنظيف العرض
   */
  private cleanupPresentation(presentationKey: string): void {
    this.clearTimers(presentationKey);
    this.clearAnimations(presentationKey);
    this.presentations.delete(presentationKey);
    this.timers.delete(presentationKey);
    this.animationFrames.delete(presentationKey);
  }
  
  /**
   * مسح المؤقتات
   */
  private clearTimers(presentationKey: string): void {
    const timers = this.timers.get(presentationKey) || [];
    timers.forEach(timer => clearTimeout(timer));
    this.timers.set(presentationKey, []);
  }
  
  /**
   * مسح الأنيميشنز
   */
  private clearAnimations(presentationKey: string): void {
    const frameId = this.animationFrames.get(presentationKey);
    if (frameId) {
      cancelAnimationFrame(frameId);
      this.animationFrames.delete(presentationKey);
    }
  }
  
  /**
   * إيقاف الصوت
   */
  private stopAudio(presentationKey: string): void {
    const state = this.presentations.get(presentationKey);
    if (!state) return;
    
    state.audioSync.isPlaying = false;
    
    const [userId, lessonId] = presentationKey.split('-');
    websocketService.sendToUser(userId, 'audio_stop', { lessonId });
  }
  
  /**
   * إيقاف الصوت مؤقتاً
   */
  private pauseAudio(presentationKey: string): void {
    const state = this.presentations.get(presentationKey);
    if (!state) return;
    
    const [userId, lessonId] = presentationKey.split('-');
    websocketService.sendToUser(userId, 'audio_pause', { lessonId });
  }
  
  /**
   * بدء تشغيل الصوت
   */
  private async startAudioPlayback(presentationKey: string): Promise<void> {
    const state = this.presentations.get(presentationKey);
    if (!state || state.audioSync.muted) return;
    
    const [userId, lessonId] = presentationKey.split('-');
    websocketService.sendToUser(userId, 'audio_resume', { lessonId });
  }
  
  /**
   * إيقاف الأنيميشنز مؤقتاً
   */
  private pauseAnimations(presentationKey: string): void {
    const state = this.presentations.get(presentationKey);
    if (!state) return;
    
    const [userId, lessonId] = presentationKey.split('-');
    
    state.animations.currentAnimations.forEach(animation => {
      websocketService.sendToUser(userId, 'animation_pause', {
        lessonId,
        animationId: animation.id
      });
    });
  }
  
  /**
   * حساب توقيتات النقاط
   */
  private calculatePointTimings(slide: GeneratedSlide): number[] {
    const pointCount = slide.points?.length || 1;
    const avgTimePerPoint = slide.duration / pointCount;
    
    return Array(pointCount).fill(avgTimePerPoint);
  }
  
  /**
   * الحصول على أنيميشن الكشف
   */
  private getRevealAnimation(pointIndex: number): Animation {
    const animations: Animation['type'][] = ['fade', 'slide', 'zoom', 'highlight'];
    const selectedType = animations[pointIndex % animations.length];
    
    return {
      id: `reveal-${pointIndex}`,
      type: selectedType,
      target: `.point-${pointIndex}`,
      duration: 500,
      delay: 0,
      easing: 'ease-out',
      properties: {
        opacity: [0, 1],
        transform: selectedType === 'slide' ? ['translateX(-20px)', 'translateX(0)'] : undefined
      }
    };
  }
  
  /**
   * إرسال حدث بدء العرض
   */
  private sendPresentationStarted(
    userId: string,
    lessonId: string,
    state: ProgressiveState
  ): void {
    websocketService.sendToUser(userId, 'progressive_presentation_started', {
      lessonId,
      slideNumber: state.currentSlideIndex,
      totalPoints: state.timeline.points.filter(p => p.type === 'point_reveal').length,
      totalDuration: state.timeline.totalDuration,
      hasAudio: state.audioSync.segments.length > 0,
      hasAnimations: true,
      playbackSpeed: state.timeline.playbackSpeed
    });
  }
  
  /**
   * الحصول على حالة العرض
   */
  getState(presentationKey: string): ProgressiveState | undefined {
    return this.presentations.get(presentationKey);
  }
  
  /**
   * تحديث تفضيلات المستخدم
   */
  updatePreferences(
    presentationKey: string,
    preferences: {
      volume?: number;
      muted?: boolean;
      animationsEnabled?: boolean;
    }
  ): void {
    const state = this.presentations.get(presentationKey);
    if (!state) return;
    
    if (preferences.volume !== undefined) {
      state.audioSync.volume = preferences.volume;
    }
    
    if (preferences.muted !== undefined) {
      state.audioSync.muted = preferences.muted;
    }
    
    const [userId, lessonId] = presentationKey.split('-');
    websocketService.sendToUser(userId, 'preferences_updated', {
      lessonId,
      preferences
    });
  }
}

// Export singleton instance
export const progressivePresenter = new ProgressivePresenterService();

function cancelAnimationFrame(frameId: number) {
    throw new Error('Function not implemented.');
}
