async function testFetch() {
  const url = 'https://jerseys-catalog.com/wp-content/uploads/2026/06/01364bd0863fd33831467a6787726a09-300x300.png';
  try {
    console.log("Fetching image:", url);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
        'Accept': 'image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.1'
      }
    });
    console.log("Status:", res.status);
    console.log("Content-Type:", res.headers.get('content-type'));
    const text = await res.text();
    console.log("Response text length:", text.length);
    console.log("Response text sample:", text.substring(0, 300));
  } catch (err) {
    console.error("Fetch error:", err.message);
  }
}

testFetch();
