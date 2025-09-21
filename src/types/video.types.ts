export interface VideoScript {
  title: string;
  duration: number; // total duration in seconds
  sections: VideoSection[];
}

export interface VideoSection {
  id: string;
  type: 'intro' | 'content' | 'example' | 'quiz' | 'summary';
  title: string;
  narration: string;
  slides: Slide[];
  duration: number; // section duration in seconds
}

export interface Slide {
  id: string;
  type: 'title' | 'content' | 'bullet' | 'image' | 'equation' | 'quiz';
  content: SlideContent;
  duration: number; // slide duration in seconds
  transitions: {
    in: 'fade' | 'slide' | 'zoom';
    out: 'fade' | 'slide' | 'zoom';
  };
}

export interface SlideContent {
  title?: string;
  subtitle?: string;
  text?: string;
  bullets?: string[];
  imageUrl?: string;
  equation?: string;
  quiz?: {
    question: string;
    options: string[];
    correctIndex: number;
  };
}

export interface AudioSegment {
  text: string;
  duration: number;
  fileUrl?: string;
  startTime: number;
  endTime: number;
}

export interface VideoGenerationJob {
  lessonId: string;
  status: 'pending' | 'script' | 'slides' | 'audio' | 'rendering' | 'completed' | 'failed';
  progress: number; // 0-100
  script?: VideoScript;
  audioUrl?: string;
  videoUrl?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface VideoConfig {
  resolution: {
    width: number;
    height: number;
  };
  fps: number;
  bitrate: string;
  format: 'mp4' | 'webm';
  quality: 'low' | 'medium' | 'high';
}