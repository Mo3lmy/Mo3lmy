const axios = require('axios');

async function testTransformation() {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3N2Q3MzMxMS01YTBiLTQ4OWEtYWU3My0wOGZjYjc4YjIzZmIiLCJlbWFpbCI6InNsaWRldGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJTVFVERU5UIiwiaWF0IjoxNzU4OTI5ODUzLCJleHAiOjE3NTk1MzQ2NTN9.qqe45UzgGj0NtM6bmuw-vVVvr-wo9pIY-nrkCU9jSW0';

  // Get a completed job
  const response = await axios.get(
    'http://localhost:3001/api/v1/lessons/slides/job/69',
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  const data = response.data.data;
  console.log('Raw status:', data.status);
  console.log('Has slides?', !!data.slides);
  console.log('Slides count:', data.slides?.length);

  // Transform like frontend does
  if (data.status === 'completed' && data.slides) {
    const slides = data.slides.map((slide, index) => {
      // Parse HTML to extract title and content type
      let type = 'content';
      let title = '';
      let subtitle = '';
      let content = '';
      let bullets = [];

      // Detect slide type from HTML classes
      if (slide.html?.includes('slide-title')) {
        type = 'title';
        const titleMatch = slide.html.match(/<h1[^>]*>([^<]*)<\/h1>/);
        const subtitleMatch = slide.html.match(/<h2[^>]*>([^<]*)<\/h2>/);
        if (titleMatch) title = titleMatch[1];
        if (subtitleMatch) subtitle = subtitleMatch[1];
      } else if (slide.html?.includes('slide-bullet')) {
        type = 'bullet';
      } else if (slide.html?.includes('slide-example')) {
        type = 'example';
      }

      // Extract title from slide header if exists
      const headerMatch = slide.html?.match(/<h2[^>]*>([^<]*)<\/h2>/);
      if (headerMatch && !title) {
        title = headerMatch[1];
      }

      return {
        id: `slide-LESSON-${index}`,
        lessonId: 'LESSON_1758905299464_qjan5xlid',
        order: slide.number - 1,
        html: slide.html || '',
        content: {
          type,
          title,
          subtitle,
          content,
          bullets: bullets.length > 0 ? bullets : undefined
        },
        theme: 'default',
        audioUrl: slide.audioUrl || '',
        duration: slide.duration || 10,
        script: slide.script || ''
      };
    });

    console.log('\n✅ Transformation successful!');
    console.log('Transformed slides count:', slides.length);
    console.log('First slide:', JSON.stringify(slides[0], null, 2));

    return {
      status: 'completed',
      slides
    };
  }

  return data;
}

testTransformation().then(result => {
  console.log('\n📊 Final result:');
  console.log('Status:', result.status);
  console.log('Slides count:', result.slides?.length);
}).catch(err => {
  console.error('Error:', err.message);
});