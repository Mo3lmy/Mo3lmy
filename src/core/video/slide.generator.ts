import puppeteer, { Browser } from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';
import type { Slide, SlideContent } from '../../types/video.types';

export class SlideGenerator {
  private browser: Browser | null = null;
  
  /**
   * Initialize Puppeteer browser
   */
  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      console.log('✅ Puppeteer browser initialized');
    }
  }
  
  /**
   * Generate slide images from script
   */
  async generateSlides(
    slides: Slide[],
    outputDir: string
  ): Promise<string[]> {
    await this.initialize();
    
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    
    const slideFiles: string[] = [];
    
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      console.log(`🖼️ Generating slide ${i + 1}/${slides.length}`);
      
      const html = this.generateSlideHTML(slide);
      const outputPath = path.join(outputDir, `slide-${i + 1}.png`);
      
      await this.renderHTMLToImage(html, outputPath);
      slideFiles.push(outputPath);
    }
    
    return slideFiles;
  }
  
  /**
   * Generate HTML for a slide
   */
  private generateSlideHTML(slide: Slide): string {
    const { type, content } = slide;
    
    // Base HTML template
    let html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          width: 1920px;
          height: 1080px;
          font-family: 'Tajawal', sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          padding: 60px;
        }
        
        .slide {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
        }
        
        h1 {
          font-size: 72px;
          font-weight: 700;
          margin-bottom: 30px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        h2 {
          font-size: 48px;
          font-weight: 400;
          margin-bottom: 20px;
          opacity: 0.9;
        }
        
        p {
          font-size: 36px;
          line-height: 1.6;
          max-width: 1400px;
        }
        
        ul {
          list-style: none;
          font-size: 32px;
          text-align: right;
          max-width: 1400px;
          width: 100%;
        }
        
        li {
          margin: 20px 0;
          padding-right: 40px;
          position: relative;
        }
        
        li:before {
          content: "◈";
          position: absolute;
          right: 0;
          color: #ffd700;
        }
        
        .quiz-option {
          background: rgba(255,255,255,0.2);
          padding: 20px;
          margin: 10px;
          border-radius: 10px;
          min-width: 300px;
        }
      </style>
    </head>
    <body>
      <div class="slide">
    `;
    
    // Add content based on slide type
    switch (type) {
      case 'title':
        html += `
          <h1>${content.title || ''}</h1>
          ${content.subtitle ? `<h2>${content.subtitle}</h2>` : ''}
        `;
        break;
        
      case 'content':
        html += `
          ${content.title ? `<h1>${content.title}</h1>` : ''}
          ${content.text ? `<p>${content.text}</p>` : ''}
        `;
        break;
        
      case 'bullet':
        html += `
          ${content.title ? `<h1>${content.title}</h1>` : ''}
          <ul>
            ${content.bullets?.map(bullet => `<li>${bullet}</li>`).join('') || ''}
          </ul>
        `;
        break;
        
      case 'quiz':
        if (content.quiz) {
          html += `
            <h1>${content.quiz.question}</h1>
            <div style="display: flex; flex-wrap: wrap; justify-content: center; margin-top: 40px;">
              ${content.quiz.options.map(option => 
                `<div class="quiz-option">${option}</div>`
              ).join('')}
            </div>
          `;
        }
        break;
        
      default:
        html += `<h1>${content.title || 'Slide'}</h1>`;
    }
    
    html += `
      </div>
    </body>
    </html>
    `;
    
    return html;
  }
  
  /**
   * Render HTML to image using Puppeteer
   */
 private async renderHTMLToImage(
  html: string,
  outputPath: string
): Promise<void> {
  if (!this.browser) {
    await this.initialize();
  }
  
  const page = await this.browser!.newPage();
  
  try {
    // Set viewport to 1080p
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });
    
    // Set HTML content
    await page.setContent(html, {
      waitUntil: 'networkidle0',
    });
    
    // Take screenshot - with proper type
    const buffer = await page.screenshot({
      type: 'png',
    });
    
    // Save to file
    await fs.writeFile(outputPath, buffer);
    
  } finally {
    await page.close();
  }
}
  
  /**
   * Create animated slide transitions
   */
  async createSlideTransition(
    slide1: string,
    slide2: string,
    transitionType: 'fade' | 'slide' | 'zoom',
    outputPath: string
  ): Promise<void> {
    // This would use FFmpeg to create transition effects
    // For now, we'll just copy the second slide
    await fs.copyFile(slide2, outputPath);
  }
  
  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('👋 Puppeteer browser closed');
    }
  }
}

// Export singleton instance
export const slideGenerator = new SlideGenerator();