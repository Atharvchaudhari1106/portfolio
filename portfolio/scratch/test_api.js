// Using native fetch

const SAAVN_API = 'https://jiosaavn-api-privatecvc2.vercel.app';

async function testApi() {
  try {
    const response = await fetch(`${SAAVN_API}/search/songs?query=tauba tauba&limit=1`);
    const data = await response.json();
    console.log(JSON.stringify(data.data.results[0].image, null, 2));
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testApi();
