// src/services/slides/slide.service.ts
// الوظيفة: توليد شرائح HTML جميلة وسريعة بدون puppeteer

export interface SlideContent {
  type: 'title' | 'content' | 'bullet' | 'image' | 'equation' | 'quiz' | 'summary' | 'interactive' | 'video' | 'code';
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
    explanation?: string;
    hints?: string[];
  };
  interactive?: {
    type: 'drag-drop' | 'fill-blank' | 'match' | 'draw';
    data: any;
  };
  video?: {
    url: string;
    poster?: string;
    autoplay?: boolean;
  };
  code?: {
    language: string;
    code: string;
    runnable?: boolean;
  };
  metadata?: {
    duration?: number;
    animations?: string[];
    theme?: string;
    emotionalTone?: 'encouraging' | 'challenging' | 'fun' | 'serious';
    adaptiveDifficulty?: boolean;
    voiceScript?: string;
    teachingNotes?: string;
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
      case 'interactive':
        return this.generateInteractiveSlide(content, theme);
      case 'video':
        return this.generateVideoSlide(content, theme);
      case 'code':
        return this.generateCodeSlide(content, theme);
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

  private generateInteractiveSlide(content: SlideContent, theme: SlideTheme): string {
    if (!content.interactive) return this.generateContentSlide(content, theme);

    const { type, data } = content.interactive;

    switch (type) {
      case 'drag-drop':
        return this.generateDragDropSlide(content, theme, data);
      case 'fill-blank':
        return this.generateFillBlankSlide(content, theme, data);
      case 'match':
        return this.generateMatchingSlide(content, theme, data);
      case 'draw':
        return this.generateDrawingSlide(content, theme, data);
      default:
        return this.generateContentSlide(content, theme);
    }
  }

  private generateVideoSlide(content: SlideContent, theme: SlideTheme): string {
    const video = content.video;
    if (!video) return this.generateContentSlide(content, theme);

    return `
      <div class="slide slide-video" style="
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
            text-align: center;
          ">${content.title}</h2>
        ` : ''}
        <div class="video-container" style="
          width: 100%;
          max-width: 900px;
          border-radius: 15px;
          overflow: hidden;
          box-shadow: 0 10px 50px rgba(0,0,0,0.2);
        ">
          <video
            controls
            ${video.autoplay ? 'autoplay' : ''}
            ${video.poster ? `poster="${video.poster}"` : ''}
            style="width: 100%; height: auto;">
            <source src="${video.url}" type="video/mp4">
            متصفحك لا يدعم عرض الفيديو
          </video>
        </div>
        ${content.content ? `
          <p style="
            font-size: 1.2em;
            text-align: center;
            margin-top: 30px;
            color: #4a5568;
            max-width: 80%;
          ">${content.content}</p>
        ` : ''}
      </div>
    `;
  }

  private generateCodeSlide(content: SlideContent, theme: SlideTheme): string {
    const code = content.code;
    if (!code) return this.generateContentSlide(content, theme);

    return `
      <div class="slide slide-code" style="
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
            margin-bottom: 30px;
          ">${content.title}</h2>
        ` : ''}
        <div class="code-container" style="
          background: #1e1e1e;
          color: #d4d4d4;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 5px 30px rgba(0,0,0,0.2);
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 1.1em;
          line-height: 1.6;
          overflow-x: auto;
        ">
          <div style="
            margin-bottom: 15px;
            padding-bottom: 15px;
            border-bottom: 1px solid #444;
            color: #9ca3af;
          ">
            ${code.language.toUpperCase()}
          </div>
          <pre style="margin: 0; white-space: pre-wrap;">${this.escapeHtml(code.code)}</pre>
        </div>
        ${code.runnable ? `
          <button style="
            margin-top: 20px;
            padding: 12px 30px;
            background: ${theme.primaryColor};
            color: white;
            border: none;
            border-radius: 25px;
            font-size: 1.1em;
            cursor: pointer;
          ">▶ تشغيل الكود</button>
        ` : ''}
        ${content.content ? `
          <p style="
            font-size: 1.2em;
            margin-top: 30px;
            color: #4a5568;
          ">${content.content}</p>
        ` : ''}
      </div>
    `;
  }

  private generateDragDropSlide(content: SlideContent, theme: SlideTheme, data: any): string {
    return `
      <div class="slide slide-drag-drop" style="
        background: ${theme.backgroundColor};
        color: #2d3748;
        font-family: ${theme.fontFamily};
        direction: ${theme.rtl ? 'rtl' : 'ltr'};
        min-height: 100vh;
        padding: 60px;
      ">
        <h2 style="color: ${theme.primaryColor}; font-size: 2.5em; margin-bottom: 40px;">
          ${content.title || 'نشاط السحب والإفلات'}
        </h2>
        <div class="drag-drop-area" style="
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 30px;
        ">
          <div class="draggable-items" style="
            background: white;
            padding: 20px;
            border-radius: 15px;
            box-shadow: 0 3px 15px rgba(0,0,0,0.1);
          ">
            <h3>العناصر</h3>
            ${(data.items || []).map((item: string, index: number) => `
              <div data-draggable="${index}" style="
                background: ${theme.primaryColor}20;
                padding: 15px;
                margin: 10px 0;
                border-radius: 8px;
                cursor: move;
                border: 2px solid ${theme.primaryColor};
              ">${item}</div>
            `).join('')}
          </div>
          <div class="drop-zones" style="
            background: white;
            padding: 20px;
            border-radius: 15px;
            box-shadow: 0 3px 15px rgba(0,0,0,0.1);
          ">
            <h3>الأهداف</h3>
            ${(data.targets || []).map((target: string, index: number) => `
              <div data-drop-zone="${index}" style="
                background: #f7f7f7;
                padding: 15px;
                margin: 10px 0;
                border-radius: 8px;
                min-height: 50px;
                border: 2px dashed #cbd5e0;
              ">${target}</div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  private generateFillBlankSlide(content: SlideContent, theme: SlideTheme, data: any): string {
    const text = (data.text || '').replace(/___/g, `
      <input type="text" style="
        border: none;
        border-bottom: 2px solid ${theme.primaryColor};
        padding: 5px 10px;
        font-size: 1em;
        font-family: inherit;
        width: 150px;
        text-align: center;
      " placeholder="...">
    `);

    return `
      <div class="slide slide-fill-blank" style="
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
        <h2 style="
          color: ${theme.primaryColor};
          font-size: 2.5em;
          margin-bottom: 40px;
        ">${content.title || 'أكمل الفراغات'}</h2>
        <div style="
          background: white;
          padding: 40px;
          border-radius: 20px;
          box-shadow: 0 5px 30px rgba(0,0,0,0.1);
          max-width: 800px;
          font-size: 1.4em;
          line-height: 2.5;
        ">
          ${text}
        </div>
        ${data.options ? `
          <div style="
            margin-top: 30px;
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            justify-content: center;
          ">
            ${data.options.map((option: string) => `
              <span style="
                background: ${theme.primaryColor}20;
                padding: 10px 20px;
                border-radius: 20px;
                border: 2px solid ${theme.primaryColor};
                cursor: pointer;
              ">${option}</span>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  private generateMatchingSlide(content: SlideContent, theme: SlideTheme, data: any): string {
    return `
      <div class="slide slide-matching" style="
        background: ${theme.backgroundColor};
        color: #2d3748;
        font-family: ${theme.fontFamily};
        direction: ${theme.rtl ? 'rtl' : 'ltr'};
        min-height: 100vh;
        padding: 60px;
      ">
        <h2 style="
          color: ${theme.primaryColor};
          font-size: 2.5em;
          margin-bottom: 40px;
          text-align: center;
        ">${content.title || 'صل بين العناصر'}</h2>
        <div style="
          display: flex;
          justify-content: space-between;
          max-width: 900px;
          margin: 0 auto;
        ">
          <div class="left-column" style="width: 40%;">
            ${(data.leftItems || []).map((item: string, index: number) => `
              <div style="
                background: white;
                padding: 20px;
                margin: 15px 0;
                border-radius: 10px;
                box-shadow: 0 3px 15px rgba(0,0,0,0.1);
                border: 3px solid ${theme.primaryColor};
                cursor: pointer;
                text-align: center;
              " data-match-left="${index}">
                ${item}
              </div>
            `).join('')}
          </div>
          <div class="connections" style="
            width: 20%;
            position: relative;
          ">
            <svg style="width: 100%; height: 100%; position: absolute;">
              <!-- Connection lines will be drawn here -->
            </svg>
          </div>
          <div class="right-column" style="width: 40%;">
            ${(data.rightItems || []).map((item: string, index: number) => `
              <div style="
                background: white;
                padding: 20px;
                margin: 15px 0;
                border-radius: 10px;
                box-shadow: 0 3px 15px rgba(0,0,0,0.1);
                border: 3px solid ${theme.secondaryColor};
                cursor: pointer;
                text-align: center;
              " data-match-right="${index}">
                ${item}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  private generateDrawingSlide(content: SlideContent, theme: SlideTheme, data: any): string {
    return `
      <div class="slide slide-drawing" style="
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
        <h2 style="
          color: ${theme.primaryColor};
          font-size: 2.5em;
          margin-bottom: 30px;
        ">${content.title || 'لوحة الرسم'}</h2>
        <canvas id="drawing-canvas" style="
          background: white;
          border: 3px solid ${theme.primaryColor};
          border-radius: 15px;
          box-shadow: 0 5px 30px rgba(0,0,0,0.15);
          cursor: crosshair;
        " width="800" height="500"></canvas>
        <div class="drawing-tools" style="
          margin-top: 20px;
          display: flex;
          gap: 15px;
        ">
          <button style="
            padding: 10px 20px;
            background: ${theme.primaryColor};
            color: white;
            border: none;
            border-radius: 20px;
            cursor: pointer;
          ">قلم</button>
          <button style="
            padding: 10px 20px;
            background: #e53e3e;
            color: white;
            border: none;
            border-radius: 20px;
            cursor: pointer;
          ">ممحاة</button>
          <button style="
            padding: 10px 20px;
            background: #48bb78;
            color: white;
            border: none;
            border-radius: 20px;
            cursor: pointer;
          ">مسح الكل</button>
        </div>
        ${content.content ? `
          <p style="
            font-size: 1.2em;
            margin-top: 20px;
            text-align: center;
            color: #4a5568;
          ">${content.content}</p>
        ` : ''}
      </div>
    `;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
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