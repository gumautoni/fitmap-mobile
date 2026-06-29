async function fetchWithTimeout(url, options = {}, timeout = 12000) {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function searchLocation(searchText) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(
    searchText
  )}`;

  const response = await fetchWithTimeout(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'FitMap/1.0',
    },
  });

  if (!response.ok) {
    throw new Error('Não foi possível localizar a região informada.');
  }

  const data = await response.json();

  return Array.isArray(data) ? data : [];
}

export async function geocodeRegion(query) {
  const formattedQuery = query.trim();

  if (!formattedQuery) {
    throw new Error('Digite uma cidade, bairro ou região para buscar.');
  }

  try {
    let data = await searchLocation(formattedQuery);

    if (!data.length) {
      data = await searchLocation(`${formattedQuery}, Brasil`);
    }

    if (!data.length) {
      throw new Error('Região não encontrada. Tente digitar uma cidade ou bairro próximo.');
    }

    const place = data[0];

    const latitude = Number(place.lat);
    const longitude = Number(place.lon);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      throw new Error('A região foi encontrada, mas as coordenadas são inválidas.');
    }

    return {
      latitude,
      longitude,
      name: place.display_name || formattedQuery,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('A busca demorou muito. Verifique sua internet e tente novamente.');
    }

    throw new Error(
      error.message || 'Não foi possível localizar a região informada.'
    );
  }
}