const axios = require('axios');

async function testJobStatus() {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3N2Q3MzMxMS01YTBiLTQ4OWEtYWU3My0wOGZjYjc4YjIzZmIiLCJlbWFpbCI6InNsaWRldGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJTVFVERU5UIiwiaWF0IjoxNzU4OTI5ODUzLCJleHAiOjE3NTk1MzQ2NTN9.qqe45UzgGj0NtM6bmuw-vVVvr-wo9pIY-nrkCU9jSW0';

  console.log('Testing job status endpoint...');

  // Test with a recent job ID from the logs (job 22)
  try {
    const response = await axios.get(
      'http://localhost:3001/api/v1/lessons/slides/job/22',
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('✅ Job Status Response:');
    console.log(JSON.stringify(response.data, null, 2));

    // Check if slides are included
    if (response.data.data && response.data.data.slides) {
      console.log(`\n📊 Total slides: ${response.data.data.slides.length}`);
      console.log('First slide HTML preview:', response.data.data.slides[0].html.substring(0, 200) + '...');
    }
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testJobStatus();