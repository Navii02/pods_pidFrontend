export const calculateScreenCoverage = (mesh, camera, engine) => {
  const boundingBox = mesh.getBoundingInfo().boundingBox;
  const centerWorld = boundingBox.centerWorld;
  const size = boundingBox.maximumWorld.subtract(boundingBox.minimumWorld);

  const dimensions = [size.x, size.y, size.z];
  const maxDimension = Math.max(...dimensions);
  const otherDimensions = dimensions.filter((dim) => dim !== maxDimension);
  const averageOfOthers =
    otherDimensions.reduce((a, b) => a + b, 0) / otherDimensions.length;

  const radiusScreen = averageOfOthers / camera.radius;
  // Get render width with fallback
  const renderWidth =
    engine && engine.getRenderWidth ? engine.getRenderWidth() : 1024; // Fallback to reasonable default

  return radiusScreen * renderWidth;
};
