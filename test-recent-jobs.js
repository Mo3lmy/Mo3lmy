const axios = require('axios');

async function testLatestJob() {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3N2Q3MzMxMS01YTBiLTQ4OWEtYWU3My0wOGZjYjc4YjIzZmIiLCJlbWFpbCI6InNsaWRldGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJTVFVERU5UIiwiaWF0IjoxNzU4OTI5ODUzLCJleHAiOjE3NTk1MzQ2NTN9.qqe45UzgGj0NtM6bmuw-vVVvr-wo9pIY-nrkCU9jSW0';

  console.log('Testing recent jobs (70 to 67)...\n');

  // Test the most recent jobs
  for (let jobId = 70; jobId >= 67; jobId--) {
    try {
      const response = await axios.get(
        `http://localhost:3001/api/v1/lessons/slides/job/${jobId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      console.log(`✅ Job ${jobId} found:`);
      console.log('  Status:', response.data.data.status);
      console.log('  Has slides:', !!response.data.data.slides);
      console.log('  Slides count:', response.data.data.slides?.length || 0);

      if (response.data.data.slides && response.data.data.slides.length > 0) {
        console.log('  First slide has HTML:', !!response.data.data.slides[0].html);
        console.log('  First slide title:', response.data.data.slides[0].title || 'N/A');
        console.log('\n🎉 Found working job with slides!');
        break;
      }
    } catch (error) {
      if (error.response) {
        console.log(`❌ Job ${jobId}: ${error.response.status} - ${error.response.data?.error?.message || 'Not found'}`);
      } else {
        console.log(`❌ Job ${jobId}: ${error.message}`);
      }
    }
  }
}

testLatestJob();