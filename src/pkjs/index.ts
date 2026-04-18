function sendLongitude(lng: number): void {
  const value = lng.toFixed(3);
  console.log(`PKJS sending LONGITUDE=${value}`);
  Pebble.sendAppMessage(
    { LONGITUDE: value },
    () => console.log("LONGITUDE sent ok"),
    (e) => console.log(`LONGITUDE send failed: ${e.error.message}`)
  );
}

Pebble.addEventListener("ready", (_e) => {
  console.log("PKJS ready");
  navigator.geolocation.getCurrentPosition(
    (pos) => sendLongitude(pos.coords.longitude),
    (err) => console.log(`location error (${err.code}): ${err.message}`),
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
  );
});
