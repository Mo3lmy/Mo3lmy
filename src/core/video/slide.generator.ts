import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';

// استيراد المكونات الرياضية
import { latexRenderer, type MathExpression } from '../interactive/math/latex-renderer';
import katex from 'katex';

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
  // Math content (جديد)
  mathExpression?: MathExpression;
  mathExpressions?: MathExpression[];
  mathProblem?: {
    problem: string;
    solution?: string;
    hints?: string[];
    steps?: any[];
  };
  interactive?: boolean;
}

export interface Slide {
  id: string;
  type: 'title' | 'content' | 'bullet' | 'image' | 'equation' | 'quiz' | 'summary' | 
        'math-content' | 'math-example' | 'math-problem' | 'math-interactive'; // أنواع جديدة للرياضيات
  content: SlideContent;
  duration: number;
  transitions: {
    in: 'fade' | 'slide' | 'zoom';
    out: 'fade' | 'slide' | 'zoom';
  };
}

export type SlideTheme = 'default' | 'dark' | 'colorful' | 'blue' | 'green';

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
  
  // ============= NEW METHOD FOR REAL-TIME WITH MATH SUPPORT =============
  /**
   * Generate HTML slide for real-time display with math support
   */
  generateRealtimeSlideHTML(
    slide: Slide,
    theme: SlideTheme = 'default'
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
    
    // Add math styles if needed
    const mathStyles = this.isMathSlide(type) ? this.getMathStyles() : '';
    
    // Build HTML based on slide type
    let slideHTML = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Cairo', sans-serif;
            background: ${currentTheme.background};
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          
          .slide-container {
            width: 100%;
            max-width: 1200px;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            animation: slideIn 0.5s ease;
          }
          
          @keyframes slideIn {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          .slide-content {
            position: relative;
            color: #2c3e50;
          }
          
          h1.slide-title {
            font-size: 2.5em;
            color: ${currentTheme === themes.green || currentTheme === themes.blue ? currentTheme.primary : '#2c3e50'};
            margin-bottom: 20px;
            text-align: center;
            animation: fadeIn 0.8s ease;
          }
          
          h2.slide-subtitle, .slide-heading {
            font-size: 1.8em;
            color: #34495e;
            margin-bottom: 15px;
            text-align: center;
            animation: fadeIn 1s ease;
          }
          
          p.slide-text {
            font-size: 1.3em;
            line-height: 1.8;
            color: #2c3e50;
            text-align: center;
            margin: 20px 0;
            animation: fadeIn 1.2s ease;
          }
          
          .slide-bullets {
            list-style: none;
            padding: 0;
            margin: 20px 0;
          }
          
          .slide-bullets li {
            font-size: 1.2em;
            margin: 15px 0;
            padding-right: 30px;
            position: relative;
            animation: slideInRight 0.5s ease forwards;
            opacity: 0;
            animation-delay: calc(var(--index) * 0.2s);
          }
          
          .slide-bullets li .bullet-icon {
            position: absolute;
            right: 0;
            color: #667eea;
          }
          
          @keyframes slideInRight {
            to { opacity: 1; transform: translateX(0); }
            from { opacity: 0; transform: translateX(-20px); }
          }
          
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          .quiz-options {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin: 30px 0;
          }
          
          .quiz-option {
            padding: 15px;
            background: #f8f9fa;
            border: 2px solid #e9ecef;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.3s;
            font-size: 1.1em;
            text-align: center;
          }
          
          .quiz-option:hover {
            background: #667eea;
            color: white;
            transform: translateY(-3px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
          }
          
          .summary-points {
            list-style: none;
            padding: 0;
          }
          
          .summary-points li {
            background: #f8f9fa;
            padding: 15px;
            margin: 10px 0;
            border-radius: 10px;
            border-right: 4px solid #667eea;
            animation: fadeIn 0.5s ease forwards;
            opacity: 0;
            animation-delay: calc(var(--index) * 0.15s);
            position: relative;
            padding-right: 50px;
          }
          
          .point-number {
            position: absolute;
            right: 15px;
            top: 50%;
            transform: translateY(-50%);
            width: 30px;
            height: 30px;
            background: #667eea;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
          }
          
          ${mathStyles}
        </style>
      </head>
      <body>
        <div class="slide-container" data-type="${type}">
          <div class="slide-content">
    `;
    
    // Handle different slide types including math
    switch (type) {
      case 'title':
        slideHTML += this.renderTitleSlide(content);
        break;
        
      case 'content':
        slideHTML += this.renderContentSlide(content);
        break;
        
      case 'bullet':
        slideHTML += this.renderBulletSlide(content);
        break;
        
      case 'quiz':
        slideHTML += this.renderQuizSlide(content);
        break;
        
      case 'summary':
        slideHTML += this.renderSummarySlide(content);
        break;
        
      case 'image':
        slideHTML += this.renderImageSlide(content);
        break;
        
      case 'equation':
      case 'math-content':
        slideHTML += this.renderMathContentSlide(content);
        break;
        
      case 'math-example':
        slideHTML += this.renderMathExampleSlide(content);
        break;
        
      case 'math-problem':
        slideHTML += this.renderMathProblemSlide(content);
        break;
        
      case 'math-interactive':
        slideHTML += this.renderMathInteractiveSlide(content);
        break;
        
      default:
        slideHTML += this.renderContentSlide(content);
    }
    
    slideHTML += `
          </div>
        </div>
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js"></script>
        <script>
          // Render all math expressions
          document.querySelectorAll('.math-expression').forEach(elem => {
            const latex = elem.getAttribute('data-latex');
            if (latex) {
              katex.render(latex, elem, {
                throwOnError: false,
                displayMode: elem.classList.contains('display-mode')
              });
            }
          });
        </script>
      </body>
      </html>
    `;
    
    return slideHTML;
  }
  
  // ============= MATH RENDERING METHODS (جديد) =============
  
  /**
   * Check if slide is math-related
   */
  private isMathSlide(type: string): boolean {
    return type.startsWith('math-') || type === 'equation';
  }
  
  /**
   * Get math-specific styles
   */
  private getMathStyles(): string {
    return `
      .math-expression {
        font-size: 1.5em;
        margin: 20px 0;
        text-align: center;
        color: #2c3e50;
      }
      
      .math-expression.display-mode {
        font-size: 2em;
        margin: 30px 0;
      }
      
      .math-step {
        background: #f8f9fa;
        padding: 20px;
        margin: 15px 0;
        border-radius: 10px;
        border-right: 4px solid #48bb78;
      }
      
      .math-step-number {
        color: #48bb78;
        font-weight: bold;
        margin-bottom: 10px;
      }
      
      .math-step-equation {
        margin: 15px 0;
        text-align: center;
      }
      
      .math-step-explanation {
        color: #718096;
        margin-top: 10px;
        text-align: center;
      }
      
      .math-problem {
        background: linear-gradient(135deg, #667eea22 0%, #764ba222 100%);
        border: 2px solid #667eea;
        padding: 30px;
        border-radius: 15px;
        margin: 20px 0;
      }
      
      .math-hint {
        background: #fef5e7;
        padding: 15px;
        margin: 10px 0;
        border-radius: 8px;
        border-right: 3px solid #f39c12;
      }
      
      .math-solution {
        background: #e6fffa;
        padding: 20px;
        margin-top: 20px;
        border-radius: 10px;
        border: 2px solid #48bb78;
      }
      
      .math-interactive {
        background: white;
        padding: 25px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        margin: 20px 0;
      }
      
      .variable-control {
        display: flex;
        align-items: center;
        margin: 15px 0;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 8px;
      }
      
      .variable-name {
        font-weight: bold;
        color: #667eea;
        min-width: 50px;
        font-size: 1.2em;
      }
      
      .variable-slider {
        flex: 1;
        margin: 0 15px;
      }
      
      .variable-value {
        background: #667eea;
        color: white;
        padding: 5px 15px;
        border-radius: 20px;
        font-weight: bold;
        min-width: 50px;
        text-align: center;
      }
      
      .math-actions {
        display: flex;
        gap: 15px;
        margin-top: 20px;
        justify-content: center;
      }
      
      .math-btn {
        padding: 12px 25px;
        border: none;
        border-radius: 8px;
        font-size: 1.1em;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.3s;
      }
      
      .math-btn-primary {
        background: #667eea;
        color: white;
      }
      
      .math-btn-success {
        background: #48bb78;
        color: white;
      }
      
      .math-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
      }
    `;
  }
  
  /**
   * Render math content slide
   */
  private renderMathContentSlide(content: SlideContent): string {
    let html = '';
    
    if (content.title) {
      html += `<h1 class="slide-title">${content.title}</h1>`;
    }
    
    if (content.mathExpression) {
      html += `
        <div class="math-expression display-mode" data-latex="${content.mathExpression.latex}"></div>
      `;
      
      if (content.mathExpression.description) {
        html += `<p class="slide-text">${content.mathExpression.description}</p>`;
      }
    } else if (content.equation) {
      html += `
        <div class="math-expression display-mode" data-latex="${content.equation}"></div>
      `;
    }
    
    if (content.text) {
      html += `<p class="slide-text">${content.text}</p>`;
    }
    
    if (content.mathExpressions && content.mathExpressions.length > 0) {
      html += '<div class="math-expressions-grid">';
      content.mathExpressions.forEach(expr => {
        html += `
          <div class="math-expression-item">
            <div class="math-expression" data-latex="${expr.latex}"></div>
            ${expr.description ? `<p class="math-description">${expr.description}</p>` : ''}
          </div>
        `;
      });
      html += '</div>';
    }
    
    return html;
  }
  
  /**
   * Render math example slide
   */
  private renderMathExampleSlide(content: SlideContent): string {
    let html = '';
    
    if (content.title) {
      html += `<h1 class="slide-title">${content.title}</h1>`;
    }
    
    if (content.mathProblem) {
      const { problem, solution, hints } = content.mathProblem;
      
      html += `
        <div class="math-problem">
          <h3>المسألة:</h3>
          <p>${problem}</p>
        </div>
      `;
      
      if (hints && hints.length > 0) {
        html += '<div class="math-hints">';
        html += '<h4>تلميحات:</h4>';
        hints.forEach(hint => {
          html += `<div class="math-hint">💡 ${hint}</div>`;
        });
        html += '</div>';
      }
      
      if (solution) {
        html += `
          <div class="math-solution">
            <h4>الحل:</h4>
            <p>${solution}</p>
          </div>
        `;
      }
    }
    
    return html;
  }
  
  /**
   * Render math problem slide with steps
   */
  private renderMathProblemSlide(content: SlideContent): string {
    let html = '';
    
    if (content.title) {
      html += `<h1 class="slide-title">${content.title}</h1>`;
    }
    
    if (content.mathProblem) {
      const { problem, steps, solution } = content.mathProblem;
      
      html += `
        <div class="math-problem">
          <p>${problem}</p>
        </div>
      `;
      
      if (steps && steps.length > 0) {
        html += '<div class="math-steps">';
        steps.forEach((step, index) => {
          html += `
            <div class="math-step">
              <div class="math-step-number">خطوة ${index + 1}:</div>
              <div class="math-step-equation">
                <div class="math-expression" data-latex="${step.latex || step}"></div>
              </div>
              ${step.explanation ? `<div class="math-step-explanation">${step.explanation}</div>` : ''}
            </div>
          `;
        });
        html += '</div>';
      } else if (solution) {
        html += `
          <div class="math-solution">
            <h4>الحل:</h4>
            <div class="math-expression display-mode" data-latex="${solution}"></div>
          </div>
        `;
      }
    }
    
    return html;
  }
  
  /**
   * Render interactive math slide
   */
  private renderMathInteractiveSlide(content: SlideContent): string {
    let html = '';
    
    if (content.title) {
      html += `<h1 class="slide-title">${content.title}</h1>`;
    }
    
    html += '<div class="math-interactive">';
    
    if (content.mathExpression && content.interactive) {
      html += `
        <div class="math-expression display-mode" data-latex="${content.mathExpression.latex}"></div>
      `;
      
      if (content.mathExpression.variables && content.mathExpression.variables.length > 0) {
        html += '<div class="variable-controls">';
        html += '<h4>عدّل المتغيرات:</h4>';
        
        content.mathExpression.variables.forEach(variable => {
          html += `
            <div class="variable-control">
              <span class="variable-name">${variable.name} =</span>
              <input type="range" class="variable-slider"
                     min="${variable.min || -10}" 
                     max="${variable.max || 10}" 
                     step="${variable.step || 1}"
                     value="${variable.value || 0}"
                     data-variable="${variable.name}">
              <span class="variable-value">${variable.value || 0}</span>
            </div>
          `;
        });
        
        html += '</div>';
      }
      
      html += `
        <div class="math-actions">
          <button class="math-btn math-btn-primary">حل المعادلة</button>
          <button class="math-btn math-btn-success">عرض الخطوات</button>
        </div>
      `;
    }
    
    html += '</div>';
    
    if (content.text) {
      html += `<p class="slide-text">${content.text}</p>`;
    }
    
    return html;
  }
  
  // ============= ORIGINAL RENDERING METHODS (محدثة) =============
  
  private renderTitleSlide(content: SlideContent): string {
    return `
      <h1 class="slide-title animate-fade-in">
        ${content.title || ''}
      </h1>
      ${content.subtitle ? `
        <h2 class="slide-subtitle animate-slide-up">
          ${content.subtitle}
        </h2>
      ` : ''}
    `;
  }
  
  private renderContentSlide(content: SlideContent): string {
    let html = '';
    
    if (content.title) {
      html += `<h2 class="slide-heading">${content.title}</h2>`;
    }
    
    // Check for math content
    if (content.equation) {
      html += `<div class="math-expression display-mode" data-latex="${content.equation}"></div>`;
    }
    
    if (content.text) {
      html += `<p class="slide-text animate-fade-in">${content.text}</p>`;
    }
    
    return html;
  }
  
  private renderBulletSlide(content: SlideContent): string {
    return `
      ${content.title ? `
        <h2 class="slide-heading">
          ${content.title}
        </h2>
      ` : ''}
      <ul class="slide-bullets">
        ${content.bullets?.map((bullet, i) => `
          <li class="animate-slide-in" style="--index: ${i}">
            <span class="bullet-icon">◈</span>
            ${bullet}
          </li>
        `).join('') || ''}
      </ul>
    `;
  }
  
  private renderQuizSlide(content: SlideContent): string {
    if (!content.quiz) return '';
    
    return `
      <h2 class="quiz-question">
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
  
  private renderSummarySlide(content: SlideContent): string {
    return `
      <h2 class="slide-heading">
        ملخص الدرس
      </h2>
      ${content.bullets ? `
        <ul class="summary-points">
          ${content.bullets.map((point, i) => `
            <li class="animate-fade-in" style="--index: ${i}">
              <span class="point-number">${i + 1}</span>
              ${point}
            </li>
          `).join('')}
        </ul>
      ` : ''}
    `;
  }
  
  private renderImageSlide(content: SlideContent): string {
    return `
      ${content.title ? `
        <h2 class="slide-heading">
          ${content.title}
        </h2>
      ` : ''}
      ${content.imageUrl ? `
        <div class="slide-image-container">
          <img src="${content.imageUrl}" alt="${content.title || 'صورة'}" 
               class="slide-image animate-zoom-in" 
               style="max-width: 100%; height: auto; border-radius: 10px;" />
        </div>
      ` : ''}
      ${content.text ? `
        <p class="image-caption" style="text-align: center; color: #718096; margin-top: 15px;">
          ${content.text}
        </p>
      ` : ''}
    `;
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
    
    // Check if it's a math slide
    const isMathSlide = slide.type && (slide.type.includes('math') || slide.type === 'equation');
    const mathImports = isMathSlide ? `
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css">
      <script src="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js"></script>
    ` : '';
    
    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1920, height=1080">
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet">
  ${mathImports}
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
    
    /* Math Styles */
    .math-display {
      font-size: 60px;
      text-align: center;
      margin: 40px 0;
      color: ${theme.primary};
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
  
  ${isMathSlide ? `
  <script>
    // Render all math expressions
    document.querySelectorAll('[data-latex]').forEach(elem => {
      const latex = elem.getAttribute('data-latex');
      if (latex) {
        katex.render(latex, elem, {
          throwOnError: false,
          displayMode: true
        });
      }
    });
  </script>
  ` : ''}
</body>
</html>
    `;
  }
  
  private renderSlideContent(slide: any, gradeLevel: number): string {
    const { type, content } = slide;
    
    // Handle math slides
    if (type && type.includes('math')) {
      return this.renderMathSlideContent(slide, gradeLevel);
    }
    
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
          ${content.equation ? `<div class="math-display" data-latex="${content.equation}"></div>` : ''}
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
        
      case 'equation':
        return `
          ${content.title ? `<h1>${content.title}</h1>` : ''}
          <div class="math-display" data-latex="${content.equation || 'x^2 + y^2 = z^2'}"></div>
          ${content.text ? `<p>${content.text}</p>` : ''}
        `;
        
      default:
        return `<h1>${content.title || 'محتوى الشريحة'}</h1>`;
    }
  }
  
  /**
   * Render math slide content for professional slides
   */
  private renderMathSlideContent(slide: any, gradeLevel: number): string {
    const { content } = slide;
    let html = '';
    
    if (content.title) {
      html += `<h1>${content.title}</h1>`;
    }
    
    if (content.equation || content.mathExpression?.latex) {
      const equation = content.equation || content.mathExpression.latex;
      html += `<div class="math-display" data-latex="${equation}"></div>`;
    }
    
    if (content.problem || content.mathProblem?.problem) {
      const problem = content.problem || content.mathProblem.problem;
      html += `<p style="font-size: 48px; margin: 30px 0;">${problem}</p>`;
    }
    
    if (content.solution || content.mathProblem?.solution) {
      const solution = content.solution || content.mathProblem.solution;
      html += `
        <div style="background: rgba(72, 187, 120, 0.1); padding: 30px; border-radius: 20px; margin-top: 40px;">
          <h2 style="color: #48bb78;">الحل:</h2>
          <p style="font-size: 42px;">${solution}</p>
        </div>
      `;
    }
    
    return html;
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