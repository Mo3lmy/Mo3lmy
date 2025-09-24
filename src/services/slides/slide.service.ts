// src/services/slides/slide.service.ts
// الوظيفة: توليد شرائح HTML جميلة وسريعة بدون puppeteer

export interface SlideContent {
  type: 'title' | 'content' | 'bullet' | 'image' | 'equation' | 'quiz' | 'summary';
  title?: string;
  subtitle?: string;
  content?: string;
  bullets?: string[];
  imageUrl?: string;
  equation?: string;
  quiz?: {
    question: string;
    options: string[];
    correctIndex?: number;
  };
  metadata?: {
    duration?: number;
    animations?: string[];
    theme?: string;
  };
}

export interface SlideTheme {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  fontFamily: string;
  rtl: boolean;
}

export class SlideService {
  // القوالب المعرفة مسبقاً
  private themes: Map<string, SlideTheme> = new Map([
    ['default', {
      name: 'default',
      primaryColor: '#667eea',
      secondaryColor: '#764ba2',
      backgroundColor: '#f7fafc',
      fontFamily: 'Cairo, sans-serif',
      rtl: true
    }],
    ['dark', {
      name: 'dark',
      primaryColor: '#4a5568',
      secondaryColor: '#2d3748',
      backgroundColor: '#1a202c',
      fontFamily: 'Cairo, sans-serif',
      rtl: true
    }],
    ['kids', {
      name: 'kids',
      primaryColor: '#f687b3',
      secondaryColor: '#9f7aea',
      backgroundColor: '#fef5e7',
      fontFamily: 'Comic Sans MS, Cairo',
      rtl: true
    }]
  ]);

  /**
   * توليد HTML لشريحة واحدة
   */
  generateSlideHTML(content: SlideContent, themeName: string = 'default'): string {
    const theme = this.themes.get(themeName) || this.themes.get('default')!;
    
    switch (content.type) {
      case 'title':
        return this.generateTitleSlide(content, theme);
      case 'content':
        return this.generateContentSlide(content, theme);
      case 'bullet':
        return this.generateBulletSlide(content, theme);
      case 'image':
        return this.generateImageSlide(content, theme);
      case 'equation':
        return this.generateEquationSlide(content, theme);
      case 'quiz':
        return this.generateQuizSlide(content, theme);
      case 'summary':
        return this.generateSummarySlide(content, theme);
      default:
        return this.generateContentSlide(content, theme);
    }
  }

  /**
   * توليد مجموعة شرائح لدرس كامل
   */
  generateLessonSlides(slides: SlideContent[], themeName: string = 'default'): string[] {
    return slides.map(slide => this.generateSlideHTML(slide, themeName));
  }

  // ============= PRIVATE METHODS - SLIDE TEMPLATES =============

  private generateTitleSlide(content: SlideContent, theme: SlideTheme): string {
    return `
      <div class="slide slide-title" style="
        background: linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%);
        color: white;
        font-family: ${theme.fontFamily};
        direction: ${theme.rtl ? 'rtl' : 'ltr'};
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        position: relative;
        overflow: hidden;
      ">
        <div class="slide-content animate-fade-in">
          ${content.title ? `<h1 style="font-size: 3.5em; margin: 0.5em 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">${content.title}</h1>` : ''}
          ${content.subtitle ? `<h2 style="font-size: 1.8em; opacity: 0.9; font-weight: 300;">${content.subtitle}</h2>` : ''}
        </div>
        <div class="decorative-circles">
          <div style="position: absolute; width: 300px; height: 300px; border-radius: 50%; background: rgba(255,255,255,0.1); top: -100px; right: -100px;"></div>
          <div style="position: absolute; width: 200px; height: 200px; border-radius: 50%; background: rgba(255,255,255,0.05); bottom: -50px; left: -50px;"></div>
        </div>
      </div>
    `;
  }

  private generateContentSlide(content: SlideContent, theme: SlideTheme): string {
    return `
      <div class="slide slide-content" style="
        background: ${theme.backgroundColor};
        color: #2d3748;
        font-family: ${theme.fontFamily};
        direction: ${theme.rtl ? 'rtl' : 'ltr'};
        min-height: 100vh;
        padding: 60px;
        display: flex;
        flex-direction: column;
      ">
        <div class="slide-header" style="border-bottom: 3px solid ${theme.primaryColor}; padding-bottom: 20px; margin-bottom: 40px;">
          ${content.title ? `<h2 style="color: ${theme.primaryColor}; font-size: 2.5em; margin: 0;">${content.title}</h2>` : ''}
        </div>
        <div class="slide-body animate-slide-up" style="flex: 1; font-size: 1.4em; line-height: 1.8;">
          ${content.content || ''}
        </div>
      </div>
    `;
  }

  private generateBulletSlide(content: SlideContent, theme: SlideTheme): string {
    const bullets = content.bullets || [];
    const bulletHTML = bullets.map((bullet, index) => `
      <li class="animate-fade-in" style="
        animation-delay: ${index * 0.2}s;
        margin: 20px 0;
        position: relative;
        padding-${theme.rtl ? 'right' : 'left'}: 40px;
      ">
        <span style="
          position: absolute;
          ${theme.rtl ? 'right' : 'left'}: 0;
          top: 5px;
          width: 25px;
          height: 25px;
          background: ${theme.primaryColor};
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8em;
        ">${index + 1}</span>
        ${bullet}
      </li>
    `).join('');

    return `
      <div class="slide slide-bullet" style="
        background: ${theme.backgroundColor};
        color: #2d3748;
        font-family: ${theme.fontFamily};
        direction: ${theme.rtl ? 'rtl' : 'ltr'};
        min-height: 100vh;
        padding: 60px;
      ">
        ${content.title ? `
          <h2 style="
            color: ${theme.primaryColor};
            font-size: 2.5em;
            margin-bottom: 40px;
            border-bottom: 3px solid ${theme.primaryColor};
            padding-bottom: 20px;
          ">${content.title}</h2>
        ` : ''}
        <ul style="list-style: none; padding: 0; font-size: 1.3em; line-height: 1.8;">
          ${bulletHTML}
        </ul>
      </div>
    `;
  }

  private generateImageSlide(content: SlideContent, theme: SlideTheme): string {
    return `
      <div class="slide slide-image" style="
        background: ${theme.backgroundColor};
        color: #2d3748;
        font-family: ${theme.fontFamily};
        direction: ${theme.rtl ? 'rtl' : 'ltr'};
        min-height: 100vh;
        padding: 60px;
        display: flex;
        flex-direction: column;
        align-items: center;
      ">
        ${content.title ? `
          <h2 style="
            color: ${theme.primaryColor};
            font-size: 2.5em;
            margin-bottom: 30px;
          ">${content.title}</h2>
        ` : ''}
        ${content.imageUrl ? `
          <div class="image-container" style="
            max-width: 80%;
            margin: 20px auto;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(0,0,0,0.15);
          ">
            <img src="${content.imageUrl}" alt="${content.title || 'صورة'}" style="width: 100%; height: auto; display: block;">
          </div>
        ` : ''}
        ${content.content ? `
          <p style="
            font-size: 1.2em;
            text-align: center;
            margin-top: 30px;
            color: #4a5568;
          ">${content.content}</p>
        ` : ''}
      </div>
    `;
  }

  private generateEquationSlide(content: SlideContent, theme: SlideTheme): string {
    return `
      <div class="slide slide-equation" style="
        background: ${theme.backgroundColor};
        color: #2d3748;
        font-family: ${theme.fontFamily};
        direction: ${theme.rtl ? 'rtl' : 'ltr'};
        min-height: 100vh;
        padding: 60px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      ">
        ${content.title ? `
          <h2 style="
            color: ${theme.primaryColor};
            font-size: 2.5em;
            margin-bottom: 40px;
          ">${content.title}</h2>
        ` : ''}
        <div class="equation-box" style="
          background: white;
          padding: 40px 60px;
          border-radius: 20px;
          box-shadow: 0 5px 30px rgba(0,0,0,0.1);
          border: 3px solid ${theme.primaryColor};
        ">
          <div style="font-size: 2em; text-align: center; font-family: 'Times New Roman', serif;">
            ${content.equation || ''}
          </div>
        </div>
        ${content.content ? `
          <p style="
            font-size: 1.3em;
            text-align: center;
            margin-top: 40px;
            color: #4a5568;
            max-width: 80%;
          ">${content.content}</p>
        ` : ''}
      </div>
    `;
  }

  private generateQuizSlide(content: SlideContent, theme: SlideTheme): string {
    const quiz = content.quiz;
    if (!quiz) return this.generateContentSlide(content, theme);

    const optionsHTML = quiz.options.map((option, index) => `
      <button class="quiz-option" style="
        display: block;
        width: 100%;
        padding: 20px;
        margin: 15px 0;
        background: white;
        border: 2px solid ${theme.primaryColor};
        border-radius: 10px;
        font-size: 1.2em;
        color: #2d3748;
        cursor: pointer;
        transition: all 0.3s;
        text-align: ${theme.rtl ? 'right' : 'left'};
        font-family: ${theme.fontFamily};
      " 
      onmouseover="this.style.background='${theme.primaryColor}'; this.style.color='white';"
      onmouseout="this.style.background='white'; this.style.color='#2d3748';">
        ${String.fromCharCode(65 + index)}. ${option}
      </button>
    `).join('');

    return `
      <div class="slide slide-quiz" style="
        background: linear-gradient(135deg, ${theme.backgroundColor} 0%, white 100%);
        color: #2d3748;
        font-family: ${theme.fontFamily};
        direction: ${theme.rtl ? 'rtl' : 'ltr'};
        min-height: 100vh;
        padding: 60px;
      ">
        <div style="
          background: ${theme.primaryColor};
          color: white;
          padding: 20px;
          border-radius: 15px;
          margin-bottom: 40px;
        ">
          <h2 style="font-size: 2em; margin: 0;">🎯 سؤال</h2>
        </div>
        <div style="
          background: white;
          padding: 30px;
          border-radius: 15px;
          box-shadow: 0 5px 20px rgba(0,0,0,0.1);
          margin-bottom: 30px;
        ">
          <h3 style="font-size: 1.6em; color: #2d3748; margin: 0;">
            ${quiz.question}
          </h3>
        </div>
        <div class="quiz-options">
          ${optionsHTML}
        </div>
      </div>
    `;
  }

  private generateSummarySlide(content: SlideContent, theme: SlideTheme): string {
    const bullets = content.bullets || [];
    const summaryHTML = bullets.map(bullet => `
      <div style="
        background: white;
        padding: 15px 20px;
        margin: 10px 0;
        border-radius: 10px;
        border-right: 5px solid ${theme.primaryColor};
        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
      ">
        ✓ ${bullet}
      </div>
    `).join('');

    return `
      <div class="slide slide-summary" style="
        background: linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%);
        color: white;
        font-family: ${theme.fontFamily};
        direction: ${theme.rtl ? 'rtl' : 'ltr'};
        min-height: 100vh;
        padding: 60px;
      ">
        <div style="text-align: center; margin-bottom: 40px;">
          <h2 style="font-size: 3em; margin: 0;">📚 الخلاصة</h2>
          ${content.subtitle ? `<p style="font-size: 1.3em; opacity: 0.9; margin-top: 10px;">${content.subtitle}</p>` : ''}
        </div>
        <div style="max-width: 800px; margin: 0 auto;">
          ${summaryHTML}
        </div>
        <div style="text-align: center; margin-top: 50px;">
          <div style="
            display: inline-block;
            padding: 15px 40px;
            background: rgba(255,255,255,0.2);
            border-radius: 50px;
            font-size: 1.2em;
          ">
            🎉 أحسنت! لقد أكملت الدرس
          </div>
        </div>
      </div>
    `;
  }

  /**
   * إضافة CSS animations
   */
  getAnimationStyles(): string {
    return `
      <style>
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes slideRight {
          from { transform: translateX(-30px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        
        .animate-fade-in {
          animation: fadeIn 0.8s ease-out forwards;
        }
        
        .animate-slide-up {
          animation: slideUp 0.6s ease-out forwards;
        }
        
        .animate-slide-right {
          animation: slideRight 0.6s ease-out forwards;
        }
      </style>
    `;
  }
}

// Export singleton instance
export const slideService = new SlideService();