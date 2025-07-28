export const canAccess = (projectId, feature, action) => {
  const user = JSON.parse(sessionStorage.getItem("userDetails"));
  const projects = JSON.parse(sessionStorage.getItem("projects"));
  //console.log(user.role);

  if (!user || !projects || !projectId) return false;

  // Global admin
  if (user.role === "admin") return true;

  const project = projects[projectId];
  if (!project) return false;

  if (project.features.project_access === "project_admin") return true;

  const featurePermission = project.features?.[feature];

  if (!featurePermission) return false;

  if (action === "VIEWER" && ["VIEWER", "EDITOR"].includes(featurePermission)) {
    console.log(action);
    console.log(featurePermission);
    return true;
  }
  if (action === "EDITOR" && featurePermission === "EDITOR") {
    console.log(featurePermission);
    console.log(action);
    return true;
  }
  return false;
};