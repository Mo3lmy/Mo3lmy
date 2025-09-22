import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';

// ============= NEW TYPES FOR REAL-TIME =============
interface RealtimeSlideOptions {
  immediate?: boolean;  // إرسال فوري أم انتظار
  transition?: 'fade' | 'slide' | 'zoom';
  duration?: number;
  theme?: 'default' | 'dark' | 'colorful' | 'blue' | 'green';
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

export interface Slide {
  id: string;
  type: 'title' | 'content' | 'bullet' | 'image' | 'equation' | 'quiz' | 'summary';
  content: SlideContent;
  duration: number;
  transitions: {
    in: 'fade' | 'slide' | 'zoom';
    out: 'fade' | 'slide' | 'zoom';
  };
}

export class EnhancedSlideGenerator {
  private browser: Browser | null = null;
  
  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ],
      });
    }
  }
  
  // ============= NEW METHOD FOR REAL-TIME =============
  /**
   * Generate HTML slide for real-time display
   */
  generateRealtimeSlideHTML(
    slide: Slide,
    theme: 'default' | 'dark' | 'colorful' | 'blue' | 'green' = 'default'
  ): string {
    const { type, content } = slide;
    
    // Theme configurations
    const themes = {
      default: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        primary: '#ffd700',
        secondary: '#ffffff',
        text: '#ffffff'
      },
      dark: {
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        primary: '#f39c12',
        secondary: '#ecf0f1',
        text: '#ecf0f1'
      },
      colorful: {
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        primary: '#fff200',
        secondary: '#ffffff',
        text: '#ffffff'
      },
      blue: {
        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        primary: '#ffffff',
        secondary: '#f8f9fa',
        text: '#ffffff'
      },
      green: {
        background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        primary: '#2c3e50',
        secondary: '#34495e',
        text: '#2c3e50'
      }
    };
    
    const currentTheme = themes[theme];
    
    // Build HTML based on slide type
    let slideHTML = `
      <div class="slide-container" 
           data-type="${type}"
           style="background: ${currentTheme.background};">
        <div class="slide-content">
    `;
    
    switch (type) {
      case 'title':
        slideHTML += `
          <h1 class="slide-title animate-fade-in" style="color: ${currentTheme.primary}">
            ${content.title || ''}
          </h1>
          ${content.subtitle ? `
            <h2 class="slide-subtitle animate-slide-up" style="color: ${currentTheme.secondary}">
              ${content.subtitle}
            </h2>
          ` : ''}
        `;
        break;
        
      case 'content':
        slideHTML += `
          ${content.title ? `
            <h2 class="slide-heading" style="color: ${currentTheme.primary}">
              ${content.title}
            </h2>
          ` : ''}
          ${content.text ? `
            <p class="slide-text animate-fade-in" style="color: ${currentTheme.text}">
              ${content.text}
            </p>
          ` : ''}
        `;
        break;
        
      case 'bullet':
        slideHTML += `
          ${content.title ? `
            <h2 class="slide-heading" style="color: ${currentTheme.primary}">
              ${content.title}
            </h2>
          ` : ''}
          <ul class="slide-bullets">
            ${content.bullets?.map((bullet, i) => `
              <li class="animate-slide-in" 
                  style="animation-delay: ${i * 0.2}s; color: ${currentTheme.text}">
                <span class="bullet-icon" style="color: ${currentTheme.primary}">◈</span>
                ${bullet}
              </li>
            `).join('') || ''}
          </ul>
        `;
        break;
        
      case 'quiz':
        if (content.quiz) {
          slideHTML += `
            <h2 class="quiz-question" style="color: ${currentTheme.primary}">
              ${content.quiz.question}
            </h2>
            <div class="quiz-options">
              ${content.quiz.options.map((option, i) => `
                <button class="quiz-option animate-scale-in" 
                        data-index="${i}" 
                        style="animation-delay: ${i * 0.1}s">
                  ${option}
                </button>
              `).join('')}
            </div>
          `;
        }
        break;
        
      case 'summary':
        slideHTML += `
          <h2 class="slide-heading" style="color: ${currentTheme.primary}">
            ملخص الدرس
          </h2>
          ${content.bullets ? `
            <ul class="summary-points">
              ${content.bullets.map((point, i) => `
                <li class="animate-fade-in" 
                    style="animation-delay: ${i * 0.15}s; color: ${currentTheme.text}">
                  <span class="point-number" style="background: ${currentTheme.primary}">
                    ${i + 1}
                  </span>
                  ${point}
                </li>
              `).join('')}
            </ul>
          ` : ''}
        `;
        break;
        
      case 'image':
        slideHTML += `
          ${content.title ? `
            <h2 class="slide-heading" style="color: ${currentTheme.primary}">
              ${content.title}
            </h2>
          ` : ''}
          ${content.imageUrl ? `
            <div class="slide-image-container">
              <img src="${content.imageUrl}" alt="${content.title || 'صورة'}" class="slide-image animate-zoom-in" />
            </div>
          ` : ''}
          ${content.text ? `
            <p class="image-caption" style="color: ${currentTheme.secondary}">
              ${content.text}
            </p>
          ` : ''}
        `;
        break;
    }
    
    slideHTML += `
        </div>
        <div class="slide-footer">
          <div class="progress-indicator"></div>
        </div>
      </div>
    `;
    
    return slideHTML;
  }
  
  // ============= EXISTING METHODS (keeping for backward compatibility) =============
  
  async generateSlides(
    slides: any[],
    outputDir: string,
    gradeLevel: number = 6
  ): Promise<string[]> {
    await this.initialize();
    await fs.mkdir(outputDir, { recursive: true });
    
    const slideFiles: string[] = [];
    
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      console.log(`🖼️ Generating slide ${i + 1}/${slides.length}: ${slide.type}`);
      
      const html = this.generateProfessionalHTML(slide, gradeLevel, i);
      const outputPath = path.join(outputDir, `slide-${String(i + 1).padStart(3, '0')}.png`);
      
      await this.renderSlide(html, outputPath);
      slideFiles.push(outputPath);
    }
    
    return slideFiles;
  }
  
  private generateProfessionalHTML(
    slide: any,
    gradeLevel: number,
    slideNumber: number
  ): string {
    const theme = this.getThemeByGrade(gradeLevel);
    
    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1920, height=1080">
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      width: 1920px;
      height: 1080px;
      font-family: 'Tajawal', Arial, sans-serif;
      background: ${theme.background};
      color: white;
      overflow: hidden;
      position: relative;
    }
    
    /* Animated Background */
    .bg-animation {
      position: absolute;
      width: 100%;
      height: 100%;
      opacity: 0.1;
      background-image: 
        radial-gradient(circle at 20% 50%, ${theme.accent} 0%, transparent 50%),
        radial-gradient(circle at 80% 80%, ${theme.primary} 0%, transparent 50%),
        radial-gradient(circle at 40% 20%, ${theme.secondary} 0%, transparent 50%);
      animation: bgMove 20s ease infinite;
    }
    
    @keyframes bgMove {
      0%, 100% { transform: scale(1) rotate(0deg); }
      50% { transform: scale(1.1) rotate(5deg); }
    }
    
    /* Main Container */
    .container {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 100px;
      z-index: 2;
    }
    
    /* Slide Content */
    .slide-content {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 40px;
      padding: 80px;
      max-width: 1600px;
      width: 100%;
      box-shadow: 
        0 30px 60px rgba(0,0,0,0.3),
        0 0 100px rgba(${theme.primaryRGB}, 0.3);
      animation: slideIn 0.8s ease;
    }
    
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(50px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    /* Typography */
    h1 {
      font-size: ${theme.titleSize};
      font-weight: 900;
      color: ${theme.primary};
      margin-bottom: 40px;
      text-align: center;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
      line-height: 1.3;
    }
    
    h2 {
      font-size: ${theme.subtitleSize};
      font-weight: 700;
      color: ${theme.secondary};
      margin-bottom: 30px;
      text-align: center;
    }
    
    p {
      font-size: ${theme.textSize};
      color: #2c3e50;
      line-height: 1.8;
      text-align: center;
      font-weight: 500;
    }
    
    /* Bullet Points */
    .bullets {
      list-style: none;
      padding: 0;
      margin: 40px 0;
    }
    
    .bullets li {
      font-size: ${theme.bulletSize};
      color: #2c3e50;
      margin: 30px 0;
      padding-right: 60px;
      position: relative;
      font-weight: 500;
      animation: bulletSlide 0.5s ease forwards;
      opacity: 0;
      animation-delay: calc(var(--index) * 0.2s);
    }
    
    @keyframes bulletSlide {
      to {
        opacity: 1;
        transform: translateX(0);
      }
      from {
        opacity: 0;
        transform: translateX(-20px);
      }
    }
    
    .bullets li::before {
      content: "${theme.bulletIcon}";
      position: absolute;
      right: 0;
      color: ${theme.accent};
      font-size: 40px;
    }
    
    /* Grade-specific decorations */
    ${gradeLevel <= 6 ? `
    .mascot {
      position: absolute;
      bottom: 50px;
      left: 100px;
      font-size: 150px;
      animation: mascotBounce 2s ease infinite;
    }
    
    @keyframes mascotBounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-30px); }
    }
    
    .stars {
      position: absolute;
      top: 50px;
      right: 100px;
      font-size: 60px;
      animation: sparkle 1.5s ease infinite;
    }
    
    @keyframes sparkle {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.2); }
    }
    ` : ''}
    
    /* Slide Number */
    .slide-number {
      position: absolute;
      bottom: 50px;
      right: 50px;
      background: ${theme.primary};
      color: white;
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      font-weight: bold;
      box-shadow: 0 10px 20px rgba(0,0,0,0.2);
    }
    
    /* Logo/Watermark */
    .logo {
      position: absolute;
      top: 50px;
      left: 50px;
      opacity: 0.8;
      font-size: 32px;
      font-weight: 700;
      color: white;
    }
  </style>
</head>
<body>
  <div class="bg-animation"></div>
  
  <div class="container">
    <div class="slide-content">
      ${this.renderSlideContent(slide, gradeLevel)}
    </div>
  </div>
  
  ${gradeLevel <= 6 ? `
    <div class="mascot">🦁</div>
    <div class="stars">✨⭐✨</div>
  ` : ''}
  
  <div class="slide-number">${slideNumber + 1}</div>
  <div class="logo">منصة التعليم الذكية</div>
</body>
</html>
    `;
  }
  
  private renderSlideContent(slide: any, gradeLevel: number): string {
    const { type, content } = slide;
    
    switch (type) {
      case 'title':
        return `
          <h1>${content.title || ''}</h1>
          ${content.subtitle ? `<h2>${content.subtitle}</h2>` : ''}
        `;
        
      case 'content':
        return `
          ${content.title ? `<h1>${content.title}</h1>` : ''}
          ${content.text ? `<p>${content.text}</p>` : ''}
        `;
        
      case 'bullet':
        return `
          ${content.title ? `<h1>${content.title}</h1>` : ''}
          <ul class="bullets">
            ${content.bullets?.map((bullet: string, i: number) => 
              `<li style="--index: ${i}">${bullet}</li>`
            ).join('') || ''}
          </ul>
        `;
        
      default:
        return `<h1>${content.title || 'محتوى الشريحة'}</h1>`;
    }
  }
  
  private getThemeByGrade(grade: number) {
    if (grade <= 6) {
      // Elementary - Colorful and playful
      return {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        primary: '#6c5ce7',
        primaryRGB: '108, 92, 231',
        secondary: '#fd79a8',
        accent: '#fdcb6e',
        titleSize: '80px',
        subtitleSize: '56px',
        textSize: '42px',
        bulletSize: '38px',
        bulletIcon: '🌟',
      };
    } else if (grade <= 9) {
      // Middle - Balanced and modern
      return {
        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        primary: '#0984e3',
        primaryRGB: '9, 132, 227',
        secondary: '#00b894',
        accent: '#ff7675',
        titleSize: '72px',
        subtitleSize: '48px',
        textSize: '38px',
        bulletSize: '34px',
        bulletIcon: '▶',
      };
    } else {
      // High - Professional and clean
      return {
        background: 'linear-gradient(135deg, #2d3436 0%, #636e72 100%)',
        primary: '#2d3436',
        primaryRGB: '45, 52, 54',
        secondary: '#0984e3',
        accent: '#e17055',
        titleSize: '68px',
        subtitleSize: '44px',
        textSize: '36px',
        bulletSize: '32px',
        bulletIcon: '◆',
      };
    }
  }
  
  private async renderSlide(html: string, outputPath: string): Promise<void> {
    const page = await this.browser!.newPage();
    
    try {
      await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 2, // Higher quality
      });
      
      await page.setContent(html, {
        waitUntil: ['load', 'domcontentloaded'],
      });
      
      // Wait for animations to complete
      await new Promise(res => setTimeout(res, 1000));
      
      await page.screenshot({
        path: outputPath as `${string}.png`,
        type: 'png',
        fullPage: false,
      });
      
    } finally {
      await page.close();
    }
  }
  
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export const enhancedSlideGenerator = new EnhancedSlideGenerator();
export const slideGenerator = enhancedSlideGenerator; // Alias for compatibility