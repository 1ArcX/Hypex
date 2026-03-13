exports.handler = async (event) => {
  const { lat, lon } = event.queryStringParameters || {}
  if (!lat || !lon) return { statusCode: 400, body: 'Missing lat/lon' }

  try {
    const res = await fetch(
      `https://cdn-secure.buienalarm.nl/api/3.4/forecast.php?lat=${lat}&lon=${lon}&region=nl&unit=mm/u`
    )
    const text = await res.text()
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      },
      body: text,
    }
  } catch (e) {
    return { statusCode: 502, body: 'Buienalarm niet bereikbaar' }
  }
}
