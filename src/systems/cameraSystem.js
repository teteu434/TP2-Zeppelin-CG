const CameraSystem = (() => {
 
  function update(dt) {
    Camera.update(dt);
  }
 
  return { update };
 
})();