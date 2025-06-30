let map;
let startCoords = null;
let endCoords = null;
let waypoints = [];
let startTime = null;
let endTime = null;

let startMarker, endMarker, waypointMarkers = [], routeLine;

window.onload = () => {
  map = L.map('map').setView([31.7683, 35.2137], 9);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
    minZoom: 2
  }).addTo(map);

  loadFromLocalStorage();
};

function getLocation(callback) {
  if (!navigator.geolocation) {
    alert("Геолокация не поддерживается");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => callback({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
    err => alert("Ошибка геолокации: " + err.message)
  );
}

function addMarker(coords, label) {
  return L.marker([coords.lat, coords.lon]).addTo(map).bindPopup(label).openPopup();
}

function saveStart() {
  getLocation(coords => {
    startCoords = coords;
    startTime = new Date();
    if (startMarker) map.removeLayer(startMarker);
    startMarker = addMarker(coords, "🟢 Старт");
    document.getElementById("start").textContent = `Начальная точка: ${formatCoords(coords)}`;
    drawRoute();
  });
}

function saveEnd() {
  getLocation(coords => {
    endCoords = coords;
    endTime = new Date();
    if (endMarker) map.removeLayer(endMarker);
    endMarker = addMarker(coords, "🔴 Финиш");
    document.getElementById("end").textContent = `Конечная точка: ${formatCoords(coords)}`;
    drawRoute();
  });
}

function addWaypoint() {
  getLocation(coords => {
    waypoints.push(coords);
    const marker = addMarker(coords, `📍 Точка ${waypoints.length}`);
    waypointMarkers.push(marker);
    drawRoute();
  });
}

function drawRoute() {
  if (routeLine) map.removeLayer(routeLine);
  const points = [];
  if (startCoords) points.push([startCoords.lat, startCoords.lon]);
  waypoints.forEach(w => points.push([w.lat, w.lon]));
  if (endCoords) points.push([endCoords.lat, endCoords.lon]);

  if (points.length >= 2) {
    routeLine = L.polyline(points, { color: 'blue' }).addTo(map);
    map.fitBounds(routeLine.getBounds());
  }
}

function calculateDistance() {
  const all = [];
  if (startCoords) all.push(startCoords);
  all.push(...waypoints);
  if (endCoords) all.push(endCoords);
  if (all.length < 2) return alert("Добавьте как минимум 2 точки");

  let sum = 0;
  for (let i = 0; i < all.length - 1; i++) {
    sum += haversine(all[i], all[i + 1]);
  }

  const timeStr = (startTime && endTime) ? getTimeDiff(startTime, endTime) : "—";
  document.getElementById("result").textContent = `Общее расстояние: ${sum.toFixed(2)} км`;
  document.getElementById("time").textContent = `Время между точками: ${timeStr}`;
}

function saveRoute() {
  const name = document.getElementById("routeTitle").value.trim() || "Без названия";
  const data = {
    name,
    startCoords,
    endCoords,
    waypoints,
    startTime: startTime ? startTime.toISOString() : null,
    endTime: endTime ? endTime.toISOString() : null
  };
  localStorage.setItem("savedRoute", JSON.stringify(data));
  alert("Маршрут сохранён!");
}

function exportRoute() {
  const name = document.getElementById("routeTitle").value.trim() || "Маршрут";
  const data = {
    name,
    startCoords,
    endCoords,
    waypoints,
    startTime,
    endTime
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name.replace(/\s+/g, '_') + ".json";
  a.click();
}

function importRoute() {
  const input = document.getElementById("importFile");
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      clearData();

      startCoords = data.startCoords;
      endCoords = data.endCoords;
      waypoints = data.waypoints || [];
      startTime = data.startTime ? new Date(data.startTime) : null;
      endTime = data.endTime ? new Date(data.endTime) : null;

      if (startCoords) startMarker = addMarker(startCoords, "🟢 Старт");
      if (endCoords) endMarker = addMarker(endCoords, "🔴 Финиш");

      waypointMarkers = waypoints.map((w, i) =>
        addMarker(w, `📍 Точка ${i + 1}`)
      );

      document.getElementById("routeTitle").value = data.name || "";
      document.getElementById("start").textContent = startCoords ? `Начальная точка: ${formatCoords(startCoords)}` : "—";
      document.getElementById("end").textContent = endCoords ? `Конечная точка: ${formatCoords(endCoords)}` : "—";

      drawRoute();
      calculateDistance();
    } catch (err) {
      alert("Ошибка при импорте JSON");
    }
  };
  reader.readAsText(file);
}

function clearData() {
  localStorage.removeItem("savedRoute");
  if (startMarker) map.removeLayer(startMarker);
  if (endMarker) map.removeLayer(endMarker);
  waypointMarkers.forEach(m => map.removeLayer(m));
  if (routeLine) map.removeLayer(routeLine);

  startCoords = null;
  endCoords = null;
  waypoints = [];
  startTime = null;
  endTime = null;
  waypointMarkers = [];
  routeLine = null;

  document.getElementById("start").textContent = "Начальная точка: —";
  document.getElementById("end").textContent = "Конечная точка: —";
  document.getElementById("result").textContent = "Общее расстояние: —";
  document.getElementById("time").textContent = "Время между точками: —";
  document.getElementById("routeTitle").value = "";
}

function formatCoords(c) {
  return `${c.lat.toFixed(5)}, ${c.lon.toFixed(5)}`;
}

function haversine(p1, p2) {
  const R = 6371;
  const dLat = toRad(p2.lat - p1.lat);
  const dLon = toRad(p2.lon - p1.lon);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * Math.PI / 180;
}

function getTimeDiff(start, end) {
  const ms = Math.abs(end - start);
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins} мин. ${secs} сек.`;
}

function loadFromLocalStorage() {
  const data = localStorage.getItem("savedRoute");
  if (!data) return;
  try {
    const parsed = JSON.parse(data);
    document.getElementById("routeTitle").value = parsed.name || "";
    startCoords = parsed.startCoords;
    endCoords = parsed.endCoords;
    waypoints = parsed.waypoints || [];
    startTime = parsed.startTime ? new Date(parsed.startTime) : null;
    endTime = parsed.endTime ? new Date(parsed.endTime) : null;

    if (startCoords) startMarker = addMarker(startCoords, "🟢 Старт");
    if (endCoords) endMarker = addMarker(endCoords, "🔴 Финиш");
    waypointMarkers = waypoints.map((w, i) =>
      addMarker(w, `📍 Точка ${i + 1}`)
    );

    document.getElementById("start").textContent = startCoords ? `Начальная точка: ${formatCoords(startCoords)}` : "—";
    document.getElementById("end").textContent = endCoords ? `Конечная точка: ${formatCoords(endCoords)}` : "—";

    drawRoute();
    calculateDistance();
  } catch (err) {
    console.error("Ошибка при загрузке маршрута");
  }
                                                   }
