module.exports = function () {
  window.__sensorAn = true;
  window.__beta = 0;
  window.__gamma = 0;
  window.__acc = { x: 0, y: 0, z: 9.81 };
  setInterval(function () {
    if (!window.__sensorAn) return;
    try {
      window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', {
        alpha: 0, beta: window.__beta, gamma: window.__gamma, absolute: false
      }));
      window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
        accelerationIncludingGravity: window.__acc, interval: 16
      }));
    } catch (e) { window.__sensorFehler = String(e); }
  }, 40);
};
