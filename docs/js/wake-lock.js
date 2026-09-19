let wakeLock = null;

async function requestWakeLock() {
  if (!("wakeLock" in navigator) || wakeLock) return;

  try {
    wakeLock = await navigator.wakeLock.request("screen");

    wakeLock.addEventListener("release", () => {
      wakeLock = null;
      console.log("Wake Lock released.");
    });

    console.log("Screen will stay on.");
  } catch (err) {
    wakeLock = null;
    console.error(err);
  }
}

window.addEventListener("load", requestWakeLock);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    requestWakeLock();
  }
});